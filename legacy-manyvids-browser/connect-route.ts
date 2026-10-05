import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getCurrentSession } from "../../../../../src/lib/auth/session";
import { openManyVidsBrowser } from "../../../../../src/lib/platforms/manyvids/browser";
import { db } from "../../../../../src/prisma/db";

export const runtime = "nodejs";

function getAppUrl() {
  const appUrl =
    process.env.APP_URL;

  if (!appUrl) {
    throw new Error(
      "APP_URL is missing.",
    );
  }

  return appUrl.replace(
    /\/+$/,
    "",
  );
}

function redirectWithStatus(
  locale: string,
  status:
    | "browser_open"
    | "error",
  reason?: string,
) {
  const appUrl =
    getAppUrl();

  const safeLocale =
    [
      "en-US",
      "pt-BR",
      "es-ES",
      "fr-FR",
      "cs-CZ",
    ].includes(locale)
      ? locale
      : "en-US";

  const url =
    new URL(
      `/${safeLocale}/app/platforms`,
      appUrl,
    );

  url.searchParams.set(
    "manyvids",
    status,
  );

  if (reason) {
    url.searchParams.set(
      "reason",
      reason,
    );
  }

  return NextResponse.redirect(
    url,
  );
}

export async function GET(
  request: NextRequest,
) {
  console.log(
    "MANYVIDS_CONNECT_START",
  );

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

    const locale =
      request.nextUrl.searchParams.get(
        "locale",
      ) ?? "en-US";

    const membership =
      await db.orm.public.WorkspaceMember
        .where({
          userId:
            auth.user.id,
        })
        .first();

    if (!membership) {
      console.error(
        "MANYVIDS_WORKSPACE_MEMBERSHIP_NOT_FOUND",
      );

      return redirectWithStatus(
        locale,
        "error",
        "workspace",
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
      console.error(
        "MANYVIDS_WORKSPACE_NOT_AVAILABLE",
      );

      return redirectWithStatus(
        locale,
        "error",
        "workspace",
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
        console.error(
          "MANYVIDS_CREATOR_NOT_FOUND",
        );

        return redirectWithStatus(
          locale,
          "error",
          "creator_not_found",
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
      console.error(
        "MANYVIDS_CREATOR_REQUIRED",
      );

      return redirectWithStatus(
        locale,
        "error",
        "creator_required",
      );
    }

    console.log(
      "MANYVIDS_BROWSER_OPENING",
      {
        creatorId:
          creator.id,
        workspaceId:
          workspace.id,
      },
    );

    await openManyVidsBrowser(
      creator.id,
    );

    console.log(
      "MANYVIDS_BROWSER_OPENED",
      {
        creatorId:
          creator.id,
      },
    );

    return redirectWithStatus(
      locale,
      "browser_open",
    );
  } catch (error) {
    console.error(
      "MANYVIDS_CONNECT_ERROR",
      error,
    );

    let locale =
      "en-US";

    try {
      locale =
        request.nextUrl.searchParams.get(
          "locale",
        ) ?? "en-US";
    } catch {
      // Keep default locale.
    }

    try {
      return redirectWithStatus(
        locale,
        "error",
        "internal",
      );
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "MANYVIDS_CONNECT_FAILED",
          message:
            "Unable to open the ManyVids managed browser.",
        },
        {
          status: 500,
        },
      );
    }
  }
}