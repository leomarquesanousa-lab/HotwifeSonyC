import { NextResponse } from "next/server";

import { db } from "../../../src/prisma/db";
import { getCurrentSession } from "../../../src/lib/auth/session";
import {
  PLATFORM_CATALOG,
  getPlatformDefinition,
} from "../../../src/lib/platforms/catalog";

export async function GET() {
  try {
    const auth = await getCurrentSession();

    if (!auth) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message: "Authentication required.",
        },
        {
          status: 401,
        },
      );
    }

    const { user } = auth;

    const membership =
      await db.orm.public.WorkspaceMember
        .where({
          userId: user.id,
        })
        .first();

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          error: "WORKSPACE_NOT_FOUND",
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
          id: membership.workspaceId,
        })
        .first();

    if (!workspace) {
      return NextResponse.json(
        {
          success: false,
          error: "WORKSPACE_NOT_FOUND",
          message:
            "Unable to load the workspace.",
        },
        {
          status: 404,
        },
      );
    }

    const platformAccounts =
      await db.orm.public.PlatformAccount
        .where({
          workspaceId: workspace.id,
        })
        .all();

    const connectedAccounts =
      platformAccounts.map((account) => {
        const definition =
          getPlatformDefinition(
            account.platform,
          );

        return {
          id: account.id,
          creatorId: account.creatorId,
          platform: account.platform,
          platformName:
            definition?.name ??
            account.platform,
          status: account.status,
          externalAccountId:
            account.externalAccountId,
          externalUsername:
            account.externalUsername,
          externalDisplayName:
            account.externalDisplayName,
          connectionType:
            account.connectionType,
          lastVerifiedAt:
            account.lastVerifiedAt,
          lastSyncAt:
            account.lastSyncAt,
          lastErrorCode:
            account.lastErrorCode,
          lastErrorMessage:
            account.lastErrorMessage,
        };
      });

    const catalog =
      PLATFORM_CATALOG.map(
        (platform) => {
          const accounts =
            connectedAccounts.filter(
              (account) =>
                account.platform ===
                platform.code,
            );

          const hasConnectedAccount =
            accounts.some(
              (account) =>
                account.status ===
                "CONNECTED",
            );

          return {
            ...platform,
            accounts,
            connected:
              hasConnectedAccount,
          };
        },
      );

    return NextResponse.json({
      success: true,

      workspace: {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        onboardingStatus:
          workspace.onboardingStatus,
        onboardingCompleted:
          Boolean(
            workspace.onboardingCompletedAt,
          ),
      },

      connectedCount:
        connectedAccounts.filter(
          (account) =>
            account.status ===
            "CONNECTED",
        ).length,

      platforms: catalog,
    });
  } catch (error) {
    console.error(
      "PLATFORMS_GET_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message:
          "Unable to load platform connections.",
      },
      {
        status: 500,
      },
    );
  }
}