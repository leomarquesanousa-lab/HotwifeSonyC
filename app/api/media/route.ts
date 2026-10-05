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

export async function GET(
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

    const workspaceMember =
      await db.orm.public.WorkspaceMember
        .where({
          userId:
            session.user.id,
        })
        .first();

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

    const performerId =
      request.nextUrl.searchParams.get(
        "performerId",
      );

    const performer =
      performerId ? await db.orm.public.Performer
        .where({
          id:
            performerId,
          workspaceId:
            workspaceMember.workspaceId,
        })
        .first() : null;

    if (performerId && !performer) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PERFORMER_NOT_FOUND",
          message:
            "The selected performer was not found.",
        },
        {
          status: 404,
        },
      );
    }

    const performerMediaLinks =
      performer ? await db.orm.public.MediaAssetPerformer
        .where({
          workspaceId:
            workspaceMember.workspaceId,
          performerId:
            performer.id,
        })
        .all() : [];

    if (
      performer && performerMediaLinks.length ===
      0
    ) {
      return NextResponse.json({
        success: true,
        performer: {
          id:
            performer.id,
          displayName:
            performer.displayName,
        },
        media: [],
        total: 0,
      });
    }

    const linkedMediaIds =
      new Set(
        performerMediaLinks.map(
          (link) =>
            link.mediaAssetId,
        ),
      );

    const workspaceMedia =
      await db.orm.public.MediaAsset
        .where({
          workspaceId:
            workspaceMember.workspaceId,
        })
        .all();

    const mediaAssets =
      workspaceMedia.filter(
        (media) =>
          !performerId || linkedMediaIds.has(
            media.id,
          ),
      );

    const sortedMedia =
      [...mediaAssets].sort(
        (
          a,
          b,
        ) =>
          String(
            b.createdAt,
          ).localeCompare(
            String(
              a.createdAt,
            ),
          ),
      );

    return NextResponse.json({
      success: true,

      ...(performer ? { performer: { id: performer.id, displayName: performer.displayName } } : {}),

      media:
        sortedMedia.map(
          (media) => ({
            id:
              media.id,

            creatorId:
              media.creatorId,

            folderId:
              media.folderId,

            originalFileName:
              media.originalFileName,

            objectKey:
              media.objectKey,

            bucketName:
              media.bucketName,

            storageProvider:
              media.storageProvider,

            contentType:
              media.contentType,

            fileSize:
              media.fileSize.toString(),

            mediaType:
              media.mediaType,

            status:
              media.status,

            durationSeconds:
              media.durationSeconds,

            width:
              media.width,

            height:
              media.height,

            thumbnailObjectKey:
              media.thumbnailObjectKey,

            objectEtag:
              media.objectEtag,

            uploadCompletedAt:
              media.uploadCompletedAt,

            processingStartedAt:
              media.processingStartedAt,

            processingCompletedAt:
              media.processingCompletedAt,

            lastErrorCode:
              media.lastErrorCode,

            lastErrorMessage:
              media.lastErrorMessage,

            createdAt:
              media.createdAt,

            updatedAt:
              media.updatedAt,
          }),
        ),

      total:
        sortedMedia.length,
    });
  } catch (error) {
    console.error(
      "MEDIA_LIBRARY_LIST_ERROR",
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