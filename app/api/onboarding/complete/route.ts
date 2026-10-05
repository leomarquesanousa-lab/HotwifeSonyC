import { NextResponse } from "next/server";

import { db } from "@/src/prisma/db";
import { requireSession } from "@/src/lib/auth/session";

export async function POST() {
  try {
    const auth =
      await requireSession();

    if (!auth) {
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

    if (!workspace) {
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

    const connectedAccounts =
      await db.orm.public.PlatformAccount
        .where({
          workspaceId:
            workspace.id,
          status:
            "CONNECTED",
        })
        .all();

    if (
      connectedAccounts.length <
      1
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PLATFORM_CONNECTION_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    const now =
      new Date().toISOString();

    await db.orm.public.Workspace
      .where({
        id:
          workspace.id,
      })
      .update({
        onboardingStatus:
          "COMPLETE",

        onboardingCompletedAt:
          now,
      });

    return NextResponse.json({
      success: true,

      workspace: {
        id:
          workspace.id,

        onboardingStatus:
          "COMPLETE",

        onboardingCompletedAt:
          now,
      },
    });
  } catch (error) {
    console.error(
      "ONBOARDING_COMPLETE_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "ONBOARDING_COMPLETE_FAILED",
      },
      {
        status: 500,
      },
    );
  }
}