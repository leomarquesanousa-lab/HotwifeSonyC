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

type UpdateDisplayNameRequest = {
  displayName?: unknown;
};

export const runtime =
  "nodejs";

export async function PATCH(
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
      id: accountId,
    } =
      await context.params;

    const account =
      await db.orm.public.PlatformAccount
        .where({
          id:
            accountId,
          workspaceId:
            membership.workspaceId,
        })
        .first();

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PLATFORM_ACCOUNT_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const body =
      (await request.json()) as UpdateDisplayNameRequest;

    if (
      typeof body.displayName !==
      "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DISPLAY_NAME_REQUIRED",
          message:
            "Display name is required.",
        },
        {
          status: 400,
        },
      );
    }

    const displayName =
      body.displayName
        .trim()
        .replace(
          /\s+/g,
          " ",
        );

    if (
      displayName.length <
      1 ||
      displayName.length >
      80
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DISPLAY_NAME_INVALID",
          message:
            "Display name must contain between 1 and 80 characters.",
        },
        {
          status: 400,
        },
      );
    }

    await db.orm.public.PlatformAccount
      .where({
        id:
          account.id,
        workspaceId:
          membership.workspaceId,
      })
      .update({
        externalDisplayName:
          displayName,
      });

    console.info(
      "PLATFORM_ACCOUNT_DISPLAY_NAME_UPDATED",
      {
        accountId:
          account.id,
        workspaceId:
          membership.workspaceId,
        platform:
          account.platform,
      },
    );

    return NextResponse.json({
      success: true,
      account: {
        id:
          account.id,
        platform:
          account.platform,
        externalAccountId:
          account.externalAccountId,
        externalUsername:
          account.externalUsername,
        externalDisplayName:
          displayName,
      },
    });
  } catch (error) {
    console.error(
      "PLATFORM_ACCOUNT_DISPLAY_NAME_UPDATE_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update display name.",
      },
      {
        status: 500,
      },
    );
  }
}
