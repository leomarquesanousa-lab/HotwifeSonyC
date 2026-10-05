import { db } from "@/src/prisma/db";
import { z } from "zod";
import {
  publishInputSchema,
  ManyVidsError,
  requireSupported,
  record,
} from "@/src/lib/platforms/manyvids/http/types";
import {
  loadLocalOptions,
  validateLocalOptions,
} from "@/src/lib/platforms/manyvids/http/local-options";
import { missingVideoMetadataFields } from "@/src/lib/media/video-metadata";
import { executeManyVidsPublication } from "./execute-manyvids";
import { reconcileManyVidsJob } from "./job-status";
import { validTimeZone } from "./schedule-time";

export async function createManyVidsSchedule(args: {
  userId: string;
  workspaceId: string;
  mediaId: string;
  accountId: string;
  scheduledAt: string;
  timeZone: string;
  options: unknown;
}) {
  if (!z.iso.datetime({ offset: true }).safeParse(args.scheduledAt).success)
    throw new ManyVidsError("SCHEDULE_INVALID", "EXECUTE", 400);
  if (Date.parse(args.scheduledAt) <= Date.now())
    throw new ManyVidsError("SCHEDULE_IN_PAST", "EXECUTE", 400);
  const scheduledAt = new Date(args.scheduledAt).toISOString();
  const parsed = publishInputSchema.safeParse({
    ...record(args.options),
    publicationId: "pending",
    publishMode: "NOW",
  });
  if (!parsed.success) throw new ManyVidsError("INVALID_INPUT", "EXECUTE", 400);
  requireSupported(parsed.data);
  const media = await db.orm.public.MediaAsset.where({
    id: args.mediaId,
    workspaceId: args.workspaceId,
  }).first();
  if (
    !media ||
    media.mediaType !== "VIDEO" ||
    media.status !== "UPLOADED" ||
    media.storageProvider !== "R2"
  )
    throw new ManyVidsError("MEDIA_NOT_READY", "EXECUTE", 409);
  if (missingVideoMetadataFields(media).length)
    throw new ManyVidsError("VIDEO_METADATA_REQUIRED", "EXECUTE", 409);
  if (media.fileSize > BigInt(10 * 1024 ** 3))
    throw new ManyVidsError("MEDIA_NOT_READY", "EXECUTE", 409);
  validateLocalOptions(
    parsed.data,
    await loadLocalOptions(args.workspaceId, media.creatorId),
    media.durationSeconds!,
  );
  // Database-only transaction: scheduling never instantiates a ManyVids client.
  return db.transaction(async (tx) => {
    const account = await tx.orm.public.PlatformAccount.where({
      id: args.accountId,
      workspaceId: args.workspaceId,
      creatorId: media.creatorId,
      platform: "MANYVIDS",
      status: "CONNECTED",
    }).first();
    const workspace = await tx.orm.public.Workspace.where({
      id: args.workspaceId,
      status: "ACTIVE",
    }).first();
    const creator = await tx.orm.public.Creator.where({
      id: media.creatorId,
      workspaceId: args.workspaceId,
      status: "ACTIVE",
    }).first();
    if (!account || !workspace || !creator)
      throw new ManyVidsError("ACCOUNT_NOT_CONNECTED", "EXECUTE", 409);
    const job = await tx.orm.public.DistributionJob.create({
      workspaceId: args.workspaceId,
      creatorId: media.creatorId,
      mediaAssetId: media.id,
      status: "SCHEDULED",
      publishMode: "SCHEDULED",
      scheduledAt,
      defaultCaption: parsed.data.description,
    });
    const id = crypto.randomUUID();
    const publication = await tx.orm.public.PlatformPublication.create({
      id,
      workspaceId: args.workspaceId,
      creatorId: media.creatorId,
      distributionJobId: job.id,
      platformAccountId: account.id,
      platform: "MANYVIDS",
      status: "SCHEDULED",
      scheduledAt,
      caption: parsed.data.description,
      attemptCount: 0,
      publishingOptions: {
        version: 1,
        timeZone: validTimeZone(args.timeZone),
        input: { ...parsed.data, publicationId: id },
      },
    });
    await tx.orm.public.AuditLog.create({
      userId: args.userId,
      action: "MANYVIDS_SCHEDULED",
      entityType: "PLATFORM_PUBLICATION",
      entityId: id,
      metadata: { scheduledAt, timeZone: validTimeZone(args.timeZone) },
    });
    return {
      success: true,
      distributionJob: {
        id: job.id,
        status: job.status,
        publishMode: job.publishMode,
        scheduledAt,
      },
      publications: [
        {
          id,
          platform: publication.platform,
          status: publication.status,
          platformAccountId: account.id,
        },
      ],
    };
  });
}

export async function runDueManyVidsPublications(
  execute = executeManyVidsPublication,
  now = new Date(),
) {
  // A killed Cron cannot release its claim. Mark stale claims for review, never re-upload.
  const interrupted = await db.orm.public.PlatformPublication.where({
    platform: "MANYVIDS",
    status: "PUBLISHING",
  })
    .where((row) =>
      row.startedAt.lt(new Date(now.getTime() - 20 * 60000).toISOString()),
    )
    .limit(20)
    .all();
  for (const row of interrupted.filter((row) => row.scheduledAt)) {
    const count = await db.orm.public.PlatformPublication.where({
      id: row.id,
      status: "PUBLISHING",
      startedAt: row.startedAt,
    }).updateAndCount({
      status: "FAILED",
      failedAt: now.toISOString(),
      lastErrorCode: "REMOTE_EXECUTION_INTERRUPTED",
      lastErrorMessage:
        "Execution interrupted; review the remote video before retrying.",
    });
    if (count)
      await reconcileManyVidsJob(row.distributionJobId, row.workspaceId);
  }
  const candidates = await db.orm.public.PlatformPublication.where({
    platform: "MANYVIDS",
    status: "SCHEDULED",
  })
    .where((row) => row.scheduledAt.lte(now.toISOString()))
    .orderBy((row) => row.scheduledAt.asc())
    .limit(20)
    .all();
  for (const publication of candidates) {
    const snapshot = record(publication.publishingOptions);
    const parsed = publishInputSchema.safeParse(snapshot.input);
    let code = "SCHEDULE_OPTIONS_MISSING";
    if (
      snapshot.version === 1 &&
      parsed.success &&
      parsed.data.publicationId === publication.id &&
      parsed.data.publishMode === "NOW"
    ) {
      const response = await execute(parsed.data, true);
      if (response.ok) return;
      const result = await response.json();
      code =
        typeof result.error === "string" ? result.error : "UNEXPECTED_FAILURE";
      if (
        [
          "ACCOUNT_PUBLICATION_IN_PROGRESS",
          "PUBLICATION_ALREADY_CLAIMED",
          "SCHEDULE_NOT_DUE",
        ].includes(code)
      )
        continue;
    }
    // Preflight failures also become visible; post-claim failures were already persisted by the executor.
    const changed = await db.orm.public.PlatformPublication.where({
      id: publication.id,
      status: "SCHEDULED",
      attemptCount: 0,
    }).updateAndCount({
      status: "FAILED",
      attemptCount: 1,
      failedAt: new Date().toISOString(),
      lastErrorCode: code,
      lastErrorMessage:
        "Scheduled publication could not complete. Review before retrying.",
    });
    if (changed)
      await reconcileManyVidsJob(
        publication.distributionJobId,
        publication.workspaceId,
      );
    console.error("MANYVIDS_SCHEDULE_FAILED", {
      publicationId: publication.id,
      code,
    });
    return; // One execution budget per invocation; later ticks handle the remaining jobs.
  }
}
