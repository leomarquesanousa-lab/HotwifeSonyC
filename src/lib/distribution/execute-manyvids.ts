import { ManyVidsTiming } from "@/src/lib/platforms/manyvids/http/timing";
import { NextResponse } from "next/server";

import { db } from "@/src/prisma/db";
import { reconcileManyVidsJob } from "@/src/lib/distribution/job-status";
import { ManyVidsClient } from "@/src/lib/platforms/manyvids/http/client";
import {
  decryptManyVidsSession,
  encryptManyVidsSession,
} from "@/src/lib/platforms/manyvids/http/session";
import { publishManyVids } from "@/src/lib/platforms/manyvids/http/publish";
import {
  ManyVidsError,
  publishInputSchema,
  requireSupported,
  safeError,
  type VideoSource,
} from "@/src/lib/platforms/manyvids/http/types";
import {
  loadLocalOptions,
  validateLocalOptions,
} from "@/src/lib/platforms/manyvids/http/local-options";

export async function executeManyVidsPublication(
  rawInput: unknown,
  scheduled = false,
) {
  const timing = new ManyVidsTiming();
  const endTiming = timing.start("EXECUTOR");
  let executionSucceeded = false;
  let claimed: { id: string; workspaceId: string; jobId: string } | null = null;
  try {
    const parsed = publishInputSchema.safeParse(rawInput);
    if (!parsed.success)
      throw new ManyVidsError("INVALID_INPUT", "EXECUTE", 400);
    const input = parsed.data;
    const publication = await db.orm.public.PlatformPublication.where({
      id: input.publicationId,
    }).first();
    if (!publication)
      throw new ManyVidsError("PUBLICATION_NOT_FOUND", "EXECUTE", 404);
    if (publication.platform !== "MANYVIDS")
      throw new ManyVidsError("NOT_MANYVIDS_PUBLICATION", "EXECUTE", 400);
    if (publication.status === "PUBLISHED") {
      executionSucceeded = true;
      return NextResponse.json({
        success: true,
        publicationId: publication.id,
        status: "PUBLISHED",
        externalPostId: publication.externalPostId,
        externalPostUrl: publication.externalPostUrl,
      });
    }
    if (
      publication.status !== (scheduled ? "SCHEDULED" : "QUEUED") ||
      publication.externalPostId ||
      publication.attemptCount > 0
    )
      throw new ManyVidsError("PUBLICATION_REQUIRES_REVIEW", "EXECUTE", 409);
    const [account, job, creator, workspace] = await Promise.all([
      db.orm.public.PlatformAccount.where({
        id: publication.platformAccountId,
        workspaceId: publication.workspaceId,
      }).first(),
      db.orm.public.DistributionJob.where({
        id: publication.distributionJobId,
        workspaceId: publication.workspaceId,
      }).first(),
      db.orm.public.Creator.where({
        id: publication.creatorId,
        workspaceId: publication.workspaceId,
      }).first(),
      db.orm.public.Workspace.where({ id: publication.workspaceId }).first(),
    ]);
    if (
      !account ||
      !job ||
      !creator ||
      workspace?.status !== "ACTIVE" ||
      creator.status !== "ACTIVE" ||
      account.platform !== "MANYVIDS" ||
      account.creatorId !== creator.id ||
      job.creatorId !== creator.id
    )
      throw new ManyVidsError("PUBLICATION_RELATION_MISMATCH", "EXECUTE", 409);
    if (account.status !== "CONNECTED")
      throw new ManyVidsError("ACCOUNT_NOT_CONNECTED", "SESSION", 409);
    if (scheduled) {
      if (
        job.publishMode !== "SCHEDULED" ||
        !publication.scheduledAt ||
        job.scheduledAt !== publication.scheduledAt ||
        Date.parse(publication.scheduledAt) > Date.now()
      )
        throw new ManyVidsError("SCHEDULE_NOT_DUE", "EXECUTE", 409);
    } else if (
      job.publishMode !== "NOW" ||
      job.scheduledAt ||
      publication.scheduledAt
    )
      throw new ManyVidsError("SCHEDULE_NOT_DUE", "EXECUTE", 409);
    const siblings = await db.orm.public.PlatformPublication.where({
      distributionJobId: job.id,
      platform: "MANYVIDS",
    }).all();
    if (siblings.length !== 1)
      throw new ManyVidsError(
        "MULTIPLE_ACCOUNTS_NOT_SUPPORTED",
        "EXECUTE",
        400,
      );
    const media = await db.orm.public.MediaAsset.where({
      id: job.mediaAssetId,
      workspaceId: workspace.id,
      creatorId: creator.id,
    }).first();
    if (
      !media ||
      media.status !== "UPLOADED" ||
      media.mediaType !== "VIDEO" ||
      media.storageProvider !== "R2"
    )
      throw new ManyVidsError("MEDIA_NOT_READY", "EXECUTE", 409);
    if (
      !media.durationSeconds ||
      !media.width ||
      !media.height ||
      media.fileSize <= BigInt(0) ||
      media.fileSize > BigInt(10 * 1024 ** 3)
    )
      throw new ManyVidsError("VIDEO_METADATA_REQUIRED", "EXECUTE", 400);
    validateLocalOptions(
      input,
      await loadLocalOptions(workspace.id, creator.id),
      media.durationSeconds,
    );
    requireSupported(input);
    if (
      input.teaser.source === "generate_from_video" &&
      input.teaser.startTime >= media.durationSeconds
    )
      throw new ManyVidsError("INVALID_TEASER_START", "TEASER", 400);
    // MediaAssetPerformer also represents library ownership; it does not identify remote co-performers.
    const credentials = decryptManyVidsSession(
      account.accessTokenEncrypted,
      account.externalAccountId,
    );
    const source: VideoSource = {
      objectKey: media.objectKey,
      bucketName: media.bucketName,
      originalFileName: media.originalFileName,
      contentType: media.contentType,
      fileSize: Number(media.fileSize),
      durationSeconds: media.durationSeconds,
      width: media.width,
      height: media.height,
    };
    const startedAt = new Date().toISOString();
    await db.transaction(async (tx) => {
      // Lock account row while checking/claiming so two jobs cannot begin for this account together.
      await tx.orm.public.PlatformAccount.where({ id: account.id }).update({
        lastVerifiedAt: account.lastVerifiedAt,
      });
      const running = await tx.orm.public.PlatformPublication.where({
        platformAccountId: account.id,
        status: "PROCESSING",
      }).first();
      const publishing = await tx.orm.public.PlatformPublication.where({
        platformAccountId: account.id,
        status: "PUBLISHING",
      }).first();
      if (running || publishing)
        throw new ManyVidsError(
          "ACCOUNT_PUBLICATION_IN_PROGRESS",
          "EXECUTE",
          409,
        );
      const count = await tx.orm.public.PlatformPublication.where({
        id: publication.id,
        workspaceId: workspace.id,
        status: scheduled ? "SCHEDULED" : "QUEUED",
        attemptCount: 0,
        externalPostId: null,
      }).updateAndCount({
        status: "PUBLISHING",
        startedAt,
        attemptCount: 1,
        failedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      });
      if (count !== 1)
        throw new ManyVidsError("PUBLICATION_ALREADY_CLAIMED", "EXECUTE", 409);
    });
    claimed = { id: publication.id, workspaceId: workspace.id, jobId: job.id };
    await reconcileManyVidsJob(job.id, workspace.id);
    const client = new ManyVidsClient(
      credentials,
      async (next) => {
        await db.orm.public.PlatformAccount.where({
          id: account.id,
          workspaceId: workspace.id,
        }).update({ accessTokenEncrypted: encryptManyVidsSession(next) });
      },
      fetch,
      scheduled ? Date.now() + 10 * 60_000 : undefined,
      timing,
    );
    const result = await publishManyVids(
      input,
      source,
      credentials.creatorId,
      client,
      async (videoId) => {
        await db.orm.public.PlatformPublication.where({
          id: publication.id,
          workspaceId: workspace.id,
        }).update({ externalPostId: videoId });
      },
    );
    await db.orm.public.PlatformPublication.where({
      id: publication.id,
      workspaceId: workspace.id,
      status: "PUBLISHING",
    }).update({
      status: "PUBLISHED",
      ...result,
      publishedAt: new Date().toISOString(),
      failedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    // A failed aggregate update must not downgrade a remotely confirmed publication.
    claimed = null;
    await reconcileManyVidsJob(job.id, workspace.id);
    executionSucceeded = true;
    return NextResponse.json({
      success: true,
      publicationId: publication.id,
      status: "PUBLISHED",
      ...result,
    });
  } catch (error) {
    const safe = safeError(error);
    if (claimed) {
      try {
        await db.orm.public.PlatformPublication.where({
          id: claimed.id,
          workspaceId: claimed.workspaceId,
          status: "PUBLISHING",
        }).update({
          status: "FAILED",
          failedAt: new Date().toISOString(),
          lastErrorCode: safe.code,
          lastErrorMessage: safe.message,
        });
        await reconcileManyVidsJob(claimed.jobId, claimed.workspaceId);
      } catch {
        console.error("MANYVIDS_STATE_PERSISTENCE_FAILED", {
          publicationId: claimed.id,
        });
        return NextResponse.json(
          {
            success: false,
            error: "STATE_PERSISTENCE_FAILED",
            message:
              "Não foi possível registrar o resultado. Revise a publicação antes de tentar novamente.",
          },
          { status: 500 },
        );
      }
    }
    console.error("MANYVIDS_HTTP_FAILED", {
      publicationId: claimed?.id,
      code: safe.code,
      stage: safe.stage,
    });
    return NextResponse.json(
      { success: false, error: safe.code, message: safe.message },
      { status: safe.httpStatus },
    );
  } finally {
    endTiming(executionSucceeded);
  }
}
