import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getCurrentSession } from "../../../../../src/lib/auth/session";
import { openManyVidsUploadArea } from "../../../../../src/lib/platforms/manyvids/browser";
import { db } from "../../../../../src/prisma/db";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
) {
  try {
    const auth =
      await getCurrentSession();

    if (!auth) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message:
            "Authentication required.",
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
            auth.user.id,
        })
        .first();

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WORKSPACE_NOT_FOUND",
          message:
            "No workspace is associated with this account.",
        },
        {
          status: 404,
        },
      );
    }

    const workspace =
      await db.orm.public.Workspace
        .where({
          id:
            membership.workspaceId,
        })
        .first();

    if (
      !workspace ||
      workspace.status !==
        "ACTIVE"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WORKSPACE_NOT_AVAILABLE",
          message:
            "The workspace is not available.",
        },
        {
          status: 403,
        },
      );
    }

    const requestedCreatorId =
      request.nextUrl.searchParams.get(
        "creatorId",
      );

    let creator = null;

    if (requestedCreatorId) {
      creator =
        await db.orm.public.Creator
          .where({
            id:
              requestedCreatorId,
            workspaceId:
              workspace.id,
          })
          .first();

      if (!creator) {
        return NextResponse.json(
          {
            success: false,
            error:
              "CREATOR_NOT_FOUND",
            message:
              "The selected creator was not found.",
          },
          {
            status: 404,
          },
        );
      }
    } else {
      creator =
        await db.orm.public.Creator
          .where({
            workspaceId:
              workspace.id,
          })
          .first();
    }

    if (!creator) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CREATOR_REQUIRED",
          message:
            "A creator must exist before opening ManyVids upload.",
        },
        {
          status: 400,
        },
      );
    }

    const account =
      await db.orm.public.PlatformAccount
        .where({
          workspaceId:
            workspace.id,
          creatorId:
            creator.id,
          platform:
            "MANYVIDS",
        })
        .first();

    if (
      !account ||
      account.status !==
        "CONNECTED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MANYVIDS_NOT_CONNECTED",
          message:
            "Connect and verify the ManyVids account first.",
        },
        {
          status: 409,
        },
      );
    }

    const result =
      await openManyVidsUploadArea(
        creator.id,
      );

    if (!result.found) {
      return NextResponse.json(
        {
          success: false,
          error:
            "UPLOAD_AREA_NOT_FOUND",
          message:
            "The ManyVids upload area could not be detected.",
          currentUrl:
            result.currentUrl,
          matchedBy:
            result.matchedBy,
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,
      found: true,
      currentUrl:
        result.currentUrl,
      matchedBy:
        result.matchedBy,
    });
  } catch (error) {
    console.error(
      "MANYVIDS_UPLOAD_AREA_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_SERVER_ERROR",
        message:
          "Unable to open the ManyVids upload area.",
      },
      {
        status: 500,
      },
    );
  }
}