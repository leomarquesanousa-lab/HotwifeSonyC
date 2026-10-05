import {
  NextResponse,
} from "next/server";

import { getCurrentSession } from "../../../../../src/lib/auth/session";
import { verifyManyVidsSession } from "../../../../../src/lib/platforms/manyvids/browser";
import { db } from "../../../../../src/prisma/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth =
      await getCurrentSession();

    if (!auth) {
      return NextResponse.json(
        {
          success: false,
          connected: false,
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
            auth.user.id,
        })
        .first();

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          connected: false,
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

    if (
      !workspace ||
      workspace.status !==
        "ACTIVE"
    ) {
      return NextResponse.json(
        {
          success: false,
          connected: false,
          error:
            "WORKSPACE_NOT_AVAILABLE",
        },
        {
          status: 403,
        },
      );
    }

    const creator =
      await db.orm.public.Creator
        .where({
          workspaceId:
            workspace.id,
        })
        .first();

    if (!creator) {
      return NextResponse.json(
        {
          success: false,
          connected: false,
          error:
            "CREATOR_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    const verification =
      await verifyManyVidsSession(
        creator.id,
      );

    if (
      !verification.connected
    ) {
      return NextResponse.json({
        success: true,
        connected: false,
        reason:
          verification.reason,
        currentUrl:
          verification.currentUrl,
      });
    }

    const now =
      new Date().toISOString();

    const existingAccount =
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

    if (existingAccount) {
      await db.orm.public.PlatformAccount
        .where({
          id:
            existingAccount.id,
        })
        .update({
          status:
            "CONNECTED",
          connectionType:
            "MANAGED_BROWSER",
          lastVerifiedAt:
            now,
          lastSyncAt:
            now,
          lastErrorCode:
            null,
          lastErrorMessage:
            null,
        });
    } else {
      await db.orm.public.PlatformAccount
        .create({
          workspaceId:
            workspace.id,
          creatorId:
            creator.id,
          platform:
            "MANYVIDS",
          status:
            "CONNECTED",
          connectionType:
            "MANAGED_BROWSER",
          lastVerifiedAt:
            now,
          lastSyncAt:
            now,
        });
    }

    console.log(
      "MANYVIDS_CONNECTED",
      {
        creatorId:
          creator.id,
        workspaceId:
          workspace.id,
      },
    );

    return NextResponse.json({
      success: true,
      connected: true,
      reason:
        verification.reason,
      currentUrl:
        verification.currentUrl,
    });
  } catch (error) {
    console.error(
      "MANYVIDS_STATUS_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        connected: false,
        error:
          "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}