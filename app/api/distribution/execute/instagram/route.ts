import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  publishInstagram,
} from "@/src/lib/distribution/instagram";

import type {
  InstagramPublishType,
} from "@/src/lib/distribution/instagram";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  db,
} from "@/src/prisma/db";

import { reconcileManyVidsJob } from "@/src/lib/distribution/job-status";

async function reconcileMixedJob(jobId: string, workspaceId: string) {
  try {
    await reconcileManyVidsJob(jobId, workspaceId);
  } catch {
    // Aggregate bookkeeping must never change the result of an Instagram publication.
    console.error("DISTRIBUTION_RECONCILE_FAILED", { jobId });
  }
}

type ExecuteInstagramRequest = {
  publicationId?: string;
  publishType?: string;
};

function normalizePublishType(
  value?: string,
): InstagramPublishType | null {
  if (!value) {
    /*
     * Backwards compatibility.
     *
     * Until the Distribution UI starts sending
     * publishType explicitly, existing Instagram
     * publications continue to work as Reels.
     */
    return "REEL";
  }

  const normalized =
    value
      .trim()
      .toUpperCase();

  if (
    normalized ===
      "POST" ||
    normalized ===
      "REEL" ||
    normalized ===
      "STORY"
  ) {
    return normalized;
  }

  return null;
}

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
          error:
            "UNAUTHORIZED",
        },
        {
          status: 401,
        },
      );
    }

    const body =
      (await request.json()) as ExecuteInstagramRequest;

    const publicationId =
      body.publicationId?.trim();

    if (!publicationId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PUBLICATION_ID_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    const publishType =
      normalizePublishType(
        body.publishType,
      );

    if (!publishType) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_INSTAGRAM_PUBLISH_TYPE",
          message:
            "Instagram publishType must be POST, REEL or STORY.",
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

    const publication =
      await db.orm.public.PlatformPublication.where({
        id:
          publicationId,
        workspaceId:
          workspaceMember.workspaceId,
      }).first();

    if (!publication) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PUBLICATION_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    if (
      publication.platform !==
      "INSTAGRAM"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "NOT_INSTAGRAM_PUBLICATION",
        },
        {
          status: 400,
        },
      );
    }

    if (
      publication.status !==
        "QUEUED" &&
      publication.status !==
        "FAILED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PUBLICATION_NOT_EXECUTABLE",
        },
        {
          status: 409,
        },
      );
    }

    const distributionJob =
      await db.orm.public.DistributionJob.where({
        id:
          publication.distributionJobId,
        workspaceId:
          workspaceMember.workspaceId,
      }).first();

    if (!distributionJob) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DISTRIBUTION_JOB_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const mediaAsset =
      await db.orm.public.MediaAsset.where({
        id:
          distributionJob.mediaAssetId,
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
          message:
            "The selected media is not ready for publishing.",
        },
        {
          status: 409,
        },
      );
    }

    const mediaType =
      mediaAsset.mediaType
        ?.trim()
        .toUpperCase();

    const contentType =
      mediaAsset.contentType
        ?.trim()
        .toLowerCase();

    const isImage =
      mediaType ===
        "IMAGE" ||
      contentType?.startsWith(
        "image/",
      );

    const isVideo =
      mediaType ===
        "VIDEO" ||
      contentType?.startsWith(
        "video/",
      );

    if (
      !isImage &&
      !isVideo
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "UNSUPPORTED_INSTAGRAM_MEDIA_TYPE",
          message:
            "Instagram publishing currently supports image and video media.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      publishType ===
        "REEL" &&
      !isVideo
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INSTAGRAM_REEL_REQUIRES_VIDEO",
          message:
            "Instagram Reels require a video.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      publishType ===
        "POST" &&
      !isImage
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INSTAGRAM_POST_REQUIRES_IMAGE",
          message:
            "Instagram Post currently requires an image. Use Reel for video publishing.",
        },
        {
          status: 400,
        },
      );
    }

    const platformAccount =
      await db.orm.public.PlatformAccount.where({
        id:
          publication.platformAccountId,
        workspaceId:
          workspaceMember.workspaceId,
        status:
          "CONNECTED",
      }).first();

    if (!platformAccount) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PLATFORM_ACCOUNT_NOT_CONNECTED",
        },
        {
          status: 409,
        },
      );
    }

    const startedAt =
      new Date().toISOString();

    await db.orm.public.PlatformPublication.where({
      id:
        publication.id,
    }).update({
      status:
        "PROCESSING",
      startedAt,
      failedAt:
        null,
      lastErrorCode:
        null,
      lastErrorMessage:
        null,
      attemptCount:
        publication.attemptCount +
        1,
    });

    try {
      console.info(
        "INSTAGRAM_PUBLICATION_EXECUTION_START",
        {
          publicationId:
            publication.id,
          publishType,
          mediaAssetId:
            mediaAsset.id,
          mediaType:
            mediaAsset.mediaType,
          contentType:
            mediaAsset.contentType,
        },
      );

      const result =
        await publishInstagram({
          platformAccount: {
            externalAccountId:
              platformAccount.externalAccountId,
            accessTokenEncrypted:
              platformAccount.accessTokenEncrypted,
          },

          mediaAsset: {
            objectKey:
              mediaAsset.objectKey,
            mediaType:
              mediaAsset.mediaType,
            contentType:
              mediaAsset.contentType,
            thumbnailObjectKey:
              mediaAsset.thumbnailObjectKey,
          },

          publication: {
            caption:
              publication.caption,
          },

          publishType,
        });

      const publishedAt =
        new Date().toISOString();

      await db.orm.public.PlatformPublication.where({
        id:
          publication.id,
      }).update({
        status:
          "PUBLISHED",
        externalPostId:
          result.externalPostId,
        publishedAt,
        failedAt:
          null,
        lastErrorCode:
          null,
        lastErrorMessage:
          null,
      });

      console.info(
        "INSTAGRAM_PUBLICATION_EXECUTION_SUCCESS",
        {
          publicationId:
            publication.id,
          publishType:
            result.publishType,
          containerId:
            result.containerId,
          externalPostId:
            result.externalPostId,
        },
      );

      await reconcileMixedJob(distributionJob.id, workspaceMember.workspaceId);

      return NextResponse.json({
        success: true,
        publicationId:
          publication.id,
        status:
          "PUBLISHED",
        publishType:
          result.publishType,
        containerId:
          result.containerId,
        externalPostId:
          result.externalPostId,
      });
    } catch (publishError) {
      const message =
        publishError instanceof Error
          ? publishError.message
          : "INSTAGRAM_PUBLISH_UNKNOWN_ERROR";

      const failedAt =
        new Date().toISOString();

      await db.orm.public.PlatformPublication.where({
        id:
          publication.id,
      }).update({
        status:
          "FAILED",
        failedAt,
        lastErrorCode:
          "INSTAGRAM_PUBLISH_FAILED",
        lastErrorMessage:
          message,
      });

      console.error(
        "INSTAGRAM_PUBLICATION_EXECUTION_FAILED",
        {
          publicationId:
            publication.id,
          publishType,
          message,
        },
      );

      await reconcileMixedJob(distributionJob.id, workspaceMember.workspaceId);

      return NextResponse.json(
        {
          success: false,
          error:
            "INSTAGRAM_PUBLISH_FAILED",
          publishType,
          message,
        },
        {
          status: 502,
        },
      );
    }
  } catch (error) {
    console.error(
      "INSTAGRAM_EXECUTE_ROUTE_ERROR",
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
