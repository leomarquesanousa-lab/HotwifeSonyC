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

export const runtime =
  "nodejs";

export async function GET(
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

    const sourceUrl =
      await getR2ObjectDownloadUrl(
        media.objectKey,
        15 * 60,
      );

    const range =
      request.headers.get(
        "range",
      );

    const upstream =
      await fetch(
        sourceUrl,
        {
          method:
            "GET",
          headers:
            range
              ? {
                  Range:
                    range,
                }
              : undefined,
          cache:
            "no-store",
        },
      );

    if (
      !upstream.ok &&
      upstream.status !==
        206
    ) {
      const body =
        await upstream
          .text()
          .catch(
            () => "",
          );

      console.error(
        "THUMBNAIL_SOURCE_R2_ERROR",
        {
          mediaId:
            media.id,
          status:
            upstream.status,
          body:
            body.slice(
              0,
              500,
            ),
        },
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "THUMBNAIL_SOURCE_FAILED",
        },
        {
          status: 502,
        },
      );
    }

    if (!upstream.body) {
      return NextResponse.json(
        {
          success: false,
          error:
            "THUMBNAIL_SOURCE_EMPTY",
        },
        {
          status: 502,
        },
      );
    }

    const headers =
      new Headers();

    headers.set(
      "Content-Type",
      upstream.headers.get(
        "content-type",
      ) ||
        media.contentType ||
        "video/mp4",
    );

    headers.set(
      "Accept-Ranges",
      upstream.headers.get(
        "accept-ranges",
      ) ||
        "bytes",
    );

    const contentLength =
      upstream.headers.get(
        "content-length",
      );

    if (contentLength) {
      headers.set(
        "Content-Length",
        contentLength,
      );
    }

    const contentRange =
      upstream.headers.get(
        "content-range",
      );

    if (contentRange) {
      headers.set(
        "Content-Range",
        contentRange,
      );
    }

    headers.set(
      "Cache-Control",
      "private, no-store",
    );

    return new NextResponse(
      upstream.body,
      {
        status:
          upstream.status,
        headers,
      },
    );
  } catch (error) {
    console.error(
      "THUMBNAIL_SOURCE_ERROR",
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
            : "Unable to load thumbnail source.",
      },
      {
        status: 500,
      },
    );
  }
}
