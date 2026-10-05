import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  getR2ObjectDownloadUrl,
  uploadBufferToR2,
} from "@/src/lib/storage/r2";

import {
  db,
} from "@/src/prisma/db";

const MAX_THUMBNAIL_BYTES =
  12 * 1024 * 1024;

const ALLOWED_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

function extensionForType(
  contentType: string,
) {
  if (
    contentType ===
    "image/png"
  ) {
    return "png";
  }

  if (
    contentType ===
    "image/webp"
  ) {
    return "webp";
  }

  return "jpg";
}

export async function POST(
  request: NextRequest,
  context: {
    params:
      Promise<{
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

    const membership =
      await db.orm.public.WorkspaceMember
        .where({
          userId:
            session.user.id,
        })
        .first();

    if (!membership) {
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

    const {
      id: mediaId,
    } =
      await context.params;

    const media =
      await db.orm.public.MediaAsset
        .where({
          id:
            mediaId,
          workspaceId:
            membership.workspaceId,
        })
        .first();

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

    if (
      media.status !==
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

    const contentType =
      request.headers
        .get(
          "content-type",
        )
        ?.split(
          ";",
        )[0]
        ?.trim()
        .toLowerCase() ||
      "";

    if (
      !ALLOWED_TYPES.has(
        contentType,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "THUMBNAIL_TYPE_UNSUPPORTED",
          message:
            "Thumbnail must be JPEG, PNG or WEBP.",
        },
        {
          status: 400,
        },
      );
    }

    const arrayBuffer =
      await request.arrayBuffer();

    if (
      arrayBuffer.byteLength <
      1
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "THUMBNAIL_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    if (
      arrayBuffer.byteLength >
      MAX_THUMBNAIL_BYTES
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "THUMBNAIL_TOO_LARGE",
        },
        {
          status: 413,
        },
      );
    }

    const extension =
      extensionForType(
        contentType,
      );

    const objectKey = [
      "workspace",
      membership.workspaceId,
      "creator",
      media.creatorId,
      "media",
      media.id,
      "thumbnails",
      `cover-${Date.now()}.${extension}`,
    ].join("/");

    const buffer =
      Buffer.from(
        arrayBuffer,
      );

    await uploadBufferToR2({
      objectKey,
      buffer,
      contentType,
    });

    await db.orm.public.MediaAsset
      .where({
        id:
          media.id,
        workspaceId:
          membership.workspaceId,
      })
      .update({
        thumbnailObjectKey:
          objectKey,
      });

    const previewUrl =
      await getR2ObjectDownloadUrl(
        objectKey,
        60 * 60,
      );

    console.info(
      "MEDIA_THUMBNAIL_SAVED",
      {
        mediaId:
          media.id,
        objectKey,
        contentType,
        size:
          arrayBuffer.byteLength,
      },
    );

    return NextResponse.json({
      success: true,
      mediaId:
        media.id,
      thumbnailObjectKey:
        objectKey,
      thumbnailUrl:
        previewUrl,
    });
  } catch (error) {
    console.error(
      "MEDIA_THUMBNAIL_SAVE_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_ERROR",
        message:
          error instanceof
          Error
            ? error.message
            : "Unable to save thumbnail.",
      },
      {
        status: 500,
      },
    );
  }
}
