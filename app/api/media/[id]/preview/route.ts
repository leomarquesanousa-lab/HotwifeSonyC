import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentSession,
} from "@/src/lib/auth/session";

import {
  getR2ObjectDownloadUrl,
} from "@/src/lib/storage/r2";

import {
  db,
} from "@/src/prisma/db";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
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
            "MEDIA_ID_REQUIRED",
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
          mediaId,
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

    const previewUrl =
      await getR2ObjectDownloadUrl(
        mediaAsset.objectKey,
        60 * 60,
      );

    return NextResponse.json({
      success: true,
      mediaId:
        mediaAsset.id,
      previewUrl,
      expiresIn:
        60 * 60,
    });
  } catch (error) {
    console.error(
      "MEDIA_PREVIEW_ERROR",
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