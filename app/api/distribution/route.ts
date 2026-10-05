import { createManyVidsSchedule } from "@/src/lib/distribution/manyvids-scheduling";
import { ManyVidsError } from "@/src/lib/platforms/manyvids/http/types";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  db,
} from "@/src/prisma/db";
import { missingVideoMetadataFields } from "@/src/lib/media/video-metadata";

type CreateDistributionRequest = {
  manyVidsOptions?: unknown;
  mediaAssetId?: string;
  platformAccountIds?: string[];
  caption?: string;
  captionsByPlatformAccountId?: Record<
    string,
    string
  >;
  publishMode?: "NOW" | "SCHEDULED";
  scheduledAt?: string | null;
};

export async function POST(
  request: NextRequest,
) {
  try {
    const session =
      await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
        },
        {
          status: 401,
        },
      );
    }

    const body =
      (await request.json()) as CreateDistributionRequest;

    const mediaAssetId =
      body.mediaAssetId?.trim();

    const platformAccountIds =
      Array.isArray(
        body.platformAccountIds,
      )
        ? body.platformAccountIds
            .map(
              (value) =>
                value.trim(),
            )
            .filter(
              Boolean,
            )
        : [];

    const caption =
      body.caption?.trim() ||
      null;

    const captionsByPlatformAccountId =
      body.captionsByPlatformAccountId &&
      typeof body.captionsByPlatformAccountId ===
        "object"
        ? Object.fromEntries(
            Object.entries(
              body.captionsByPlatformAccountId,
            )
              .filter(
                ([key, value]) =>
                  typeof key ===
                    "string" &&
                  typeof value ===
                    "string",
              )
              .map(
                ([key, value]) => [
                  key.trim(),
                  value
                    .trim()
                    .slice(
                      0,
                      2200,
                    ),
                ],
              )
              .filter(
                ([key]) =>
                  Boolean(key),
              ),
          )
        : {};

    const publishMode =
      body.publishMode ===
      "SCHEDULED"
        ? "SCHEDULED"
        : "NOW";

    const scheduledAt =
      publishMode ===
      "SCHEDULED"
        ? body.scheduledAt?.trim() ||
          null
        : null;

    if (
      !mediaAssetId ||
      platformAccountIds.length ===
        0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_REQUEST",
        },
        {
          status: 400,
        },
      );
    }

    if (
      publishMode ===
        "SCHEDULED" &&
      !scheduledAt
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SCHEDULED_AT_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    const workspaceMember =
      await db.orm.public.WorkspaceMember.where({
        userId:
          session.user.id,
      }).first();

    if (!workspaceMember) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WORKSPACE_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const mediaAsset =
      await db.orm.public.MediaAsset.where({
        id:
          mediaAssetId,
        workspaceId:
          workspaceMember.workspaceId,
      }).first();

    if (!mediaAsset) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    if (
      mediaAsset.status !==
      "UPLOADED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_NOT_READY",
        },
        {
          status: 409,
        },
      );
    }

    const platformAccounts =
      await db.orm.public.PlatformAccount.where({
        workspaceId:
          workspaceMember.workspaceId,
        status:
          "CONNECTED",
      }).all();

    const selectedAccounts =
      platformAccounts.filter(
        (account) =>
          platformAccountIds.includes(
            account.id,
          ),
      );

    if (
      selectedAccounts.length !==
      platformAccountIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_PLATFORM_ACCOUNT",
        },
        {
          status: 400,
        },
      );
    }

    if (
      selectedAccounts.some(
        (account) =>
          account.creatorId !==
          mediaAsset.creatorId,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PLATFORM_CREATOR_MISMATCH",
        },
        {
          status: 400,
        },
      );
    }

    if (mediaAsset.mediaType === "VIDEO" && selectedAccounts.some((account) => account.platform === "MANYVIDS")) {
      const missingFields = missingVideoMetadataFields(mediaAsset);
      if (missingFields.length) {
        return NextResponse.json({ success: false, error: "VIDEO_METADATA_REQUIRED", missingFields, message: "Esta mídia antiga precisa de extração de metadados antes de publicar no ManyVids. Nenhuma distribuição foi criada." }, { status: 409 });
      }
    }

    if (publishMode === "SCHEDULED" && selectedAccounts.some(account => account.platform === "MANYVIDS")) {
      if (selectedAccounts.length !== 1) throw new ManyVidsError("SCHEDULE_MANYVIDS_ONLY", "EXECUTE", 400);
      return NextResponse.json(await createManyVidsSchedule({userId:session.user.id,workspaceId:workspaceMember.workspaceId,mediaId:mediaAsset.id,accountId:selectedAccounts[0].id,scheduledAt:scheduledAt!,timeZone:session.user.timezone,options:body.manyVidsOptions}));
    }

    const now =
      new Date().toISOString();

    const distributionJob =
      await db.orm.public.DistributionJob.create({
        workspaceId:
          workspaceMember.workspaceId,
        creatorId:
          mediaAsset.creatorId,
        mediaAssetId:
          mediaAsset.id,
        status:
          publishMode ===
          "NOW"
            ? "QUEUED"
            : "SCHEDULED",
        publishMode,
        defaultCaption:
          caption,
        scheduledAt,
        startedAt:
          null,
        completedAt:
          null,
        lastErrorCode:
          null,
        lastErrorMessage:
          null,
        createdAt:
          now,
        updatedAt:
          now,
      });

    const publications =
      [];

    for (
      const account of
      selectedAccounts
    ) {
      const platformCaption =
        captionsByPlatformAccountId[
          account.id
        ] ||
        caption;

      const publication =
        await db.orm.public.PlatformPublication.create({
          workspaceId:
            workspaceMember.workspaceId,
          creatorId:
            mediaAsset.creatorId,
          distributionJobId:
            distributionJob.id,
          platformAccountId:
            account.id,
          platform:
            account.platform,
          status:
            publishMode ===
            "NOW"
              ? "QUEUED"
              : "SCHEDULED",
          caption:
            platformCaption,
          scheduledAt,
          externalPostId:
            null,
          externalPostUrl:
            null,
          attemptCount:
            0,
          startedAt:
            null,
          publishedAt:
            null,
          failedAt:
            null,
          lastErrorCode:
            null,
          lastErrorMessage:
            null,
          createdAt:
            now,
          updatedAt:
            now,
        });

      publications.push({
        id:
          publication.id,
        platform:
          publication.platform,
        status:
          publication.status,
        platformAccountId:
          publication.platformAccountId,
        caption:
          publication.caption,
      });
    }

    return NextResponse.json({
      success: true,
      distributionJob: {
        id:
          distributionJob.id,
        mediaAssetId:
          distributionJob.mediaAssetId,
        status:
          distributionJob.status,
        publishMode:
          distributionJob.publishMode,
        scheduledAt:
          distributionJob.scheduledAt,
        caption:
          distributionJob.defaultCaption,
      },
      publications,
    });
  } catch (error) {
    if (error instanceof ManyVidsError) return NextResponse.json({success:false,error:error.code},{status:error.httpStatus});
    console.error(
      "DISTRIBUTION_CREATE_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}
