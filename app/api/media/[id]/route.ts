import {
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  getR2Client,
} from "@/src/lib/storage/r2";

import {
  db,
} from "@/src/prisma/db";

export async function DELETE(
  _request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
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

    const {
      id,
    } =
      await context.params;

    const mediaId =
      id?.trim();

    if (!mediaId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_MEDIA_ID",
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

    const media =
      await db.orm.public.MediaAsset.where({
        id:
          mediaId,
        workspaceId:
          workspaceMember.workspaceId,
      }).first();

    if (!media) {
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

    const distributionJob =
      await db.orm.public.DistributionJob.where({
        workspaceId:
          workspaceMember.workspaceId,
        mediaAssetId:
          media.id,
      }).first();

    if (distributionJob) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MEDIA_HAS_PUBLICATION_HISTORY",
          message:
            "This video has publication history and cannot be permanently removed from the Media Library.",
        },
        {
          status: 409,
        },
      );
    }

    const hasCompletedUpload =
      media.status ===
      "UPLOADED";

    if (hasCompletedUpload) {
      try {
        const client =
          getR2Client();

        await client.send(
          new DeleteObjectCommand({
            Bucket:
              media.bucketName,
            Key:
              media.objectKey,
          }),
        );

        if (
          media.thumbnailObjectKey
        ) {
          await client.send(
            new DeleteObjectCommand({
              Bucket:
                media.bucketName,
              Key:
                media.thumbnailObjectKey,
            }),
          );
        }
      } catch (error) {
        console.error(
          "MEDIA_R2_DELETE_ERROR",
          {
            mediaId:
              media.id,
            status:
              media.status,
            bucketName:
              media.bucketName,
            objectKey:
              media.objectKey,
            thumbnailObjectKey:
              media.thumbnailObjectKey,
            error,
          },
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "STORAGE_DELETE_FAILED",
            message:
              "The video could not be removed from storage. No database record was deleted.",
          },
          {
            status: 502,
          },
        );
      }
    } else {
      console.info(
        "MEDIA_DELETE_INCOMPLETE_UPLOAD",
        {
          mediaId:
            media.id,
          status:
            media.status,
          objectKey:
            media.objectKey,
        },
      );
    }

    try {
      /*
       * Remove performer associations first.
       *
       * MediaAssetPerformer references MediaAsset through
       * mediaAssetId, so the parent MediaAsset cannot be
       * deleted while these rows still exist.
       */
      await db.orm.public.MediaAssetPerformer.where({
        mediaAssetId:
          media.id,
      }).delete();

      const deleted =
        await db.orm.public.MediaAsset.where({
          id:
            media.id,
          workspaceId:
            workspaceMember.workspaceId,
        }).delete();

      if (!deleted) {
        console.error(
          "MEDIA_DATABASE_DELETE_MISSING",
          {
            mediaId:
              media.id,
            status:
              media.status,
          },
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "DATABASE_DELETE_FAILED",
            message:
              "The Media Library record could not be deleted.",
          },
          {
            status: 500,
          },
        );
      }
    } catch (error) {
      console.error(
        "MEDIA_DATABASE_DELETE_ERROR",
        {
          mediaId:
            media.id,
          status:
            media.status,
          objectKey:
            media.objectKey,
          error,
        },
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "DATABASE_DELETE_FAILED",
          message:
            "The Media Library record could not be deleted.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      mediaId:
        media.id,
      deletedFileName:
        media.originalFileName,
      deletedFromStorage:
        hasCompletedUpload,
    });
  } catch (error) {
    console.error(
      "MEDIA_DELETE_ERROR",
      {
        error,
      },
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_ERROR",
        message:
          "An unexpected error occurred while removing the media.",
      },
      {
        status: 500,
      },
    );
  }
}