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

export async function GET(
  request: NextRequest,
  context: {
    params:
      Promise<{
        id: string;
        documentId: string;
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

    const {
      id: performerId,
      documentId,
    } =
      await context.params;

    const document =
      await db.orm.public.PerformerDocument.where({
        id:
          documentId,
        performerId,
        workspaceId:
          workspaceMember.workspaceId,
      }).first();

    if (!document) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DOCUMENT_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const url =
      await getR2ObjectDownloadUrl(
        document.objectKey,
        10 * 60,
      );

    const download =
      request.nextUrl.searchParams.get(
        "download",
      ) === "1";

    if (download) {
      return NextResponse.redirect(
        url,
        {
          status: 302,
        },
      );
    }

    return NextResponse.json({
      success: true,
      url,
      document: {
        id:
          document.id,
        title:
          document.title,
        contentType:
          document.contentType,
      },
    });
  } catch (error) {
    console.error(
      "PERFORMER_DOCUMENT_OPEN_ERROR",
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
