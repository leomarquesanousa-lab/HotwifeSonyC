import {
  randomBytes,
} from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getCurrentSession } from "../../../../../src/lib/auth/session";

import { db } from "../../../../../src/prisma/db";

const INSTAGRAM_AUTHORIZATION_URL =
  "https://www.instagram.com/oauth/authorize";

const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
];

const OAUTH_STATE_COOKIE =
  "instagram_oauth_state";

const OAUTH_CREATOR_COOKIE =
  "instagram_oauth_creator";

const OAUTH_LOCALE_COOKIE =
  "instagram_oauth_locale";

const OAUTH_RETURN_TO_COOKIE =
  "instagram_oauth_return_to";

type SupportedLocale =
  | "en-US"
  | "pt-BR"
  | "es-ES"
  | "fr-FR";

function normalizeLocale(
  value: string | null,
): SupportedLocale {
  if (
    value === "pt-BR" ||
    value === "es-ES" ||
    value === "fr-FR"
  ) {
    return value;
  }

  return "en-US";
}

function normalizeReturnTo(
  value: string | null,
) {
  return value ===
    "app-platforms"
    ? "app-platforms"
    : "onboarding-platforms";
}

function base64UrlEncode(
  buffer: Buffer,
) {
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function GET(
  request: NextRequest,
) {
  console.log(
    "INSTAGRAM_CONNECT_START",
    {
      environment:
        process.env.NODE_ENV,
      host:
        request.headers.get(
          "host",
        ),
      forwardedHost:
        request.headers.get(
          "x-forwarded-host",
        ),
      forwardedProto:
        request.headers.get(
          "x-forwarded-proto",
        ),
      hasSessionCookie:
        request.cookies.has(
          "creator_session",
        ),
    },
  );

  try {
    const locale =
      normalizeLocale(
        request.nextUrl.searchParams.get(
          "locale",
        ),
      );

    const returnTo =
      normalizeReturnTo(
        request.nextUrl.searchParams.get(
          "returnTo",
        ),
      );

    const auth =
      await getCurrentSession();

    if (!auth) {
      console.error(
        "INSTAGRAM_CONNECT_UNAUTHORIZED",
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "UNAUTHORIZED",
          message:
            "Authentication required.",
        },
        {
          status: 401,
        },
      );
    }

    console.log(
      "INSTAGRAM_SESSION_OK",
    );

    const clientId =
      process.env
        .INSTAGRAM_APP_ID;

    const redirectUri =
      process.env
        .INSTAGRAM_REDIRECT_URI;

    console.log(
      "INSTAGRAM_ENV_CHECK",
      {
        hasClientId:
          Boolean(
            clientId,
          ),
        hasRedirectUri:
          Boolean(
            redirectUri,
          ),
        redirectUri:
          redirectUri ??
          null,
      },
    );

    if (
      !clientId ||
      !redirectUri
    ) {
      console.error(
        "INSTAGRAM_OAUTH_CONFIG_MISSING",
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "INSTAGRAM_CONFIGURATION_ERROR",
          message:
            "Instagram integration is not configured.",
        },
        {
          status: 500,
        },
      );
    }

    console.log(
      "INSTAGRAM_ENV_OK",
    );

    const membership =
      await db.orm.public.WorkspaceMember
        .where({
          userId:
            auth.user.id,
        })
        .first();

    if (!membership) {
      console.error(
        "INSTAGRAM_WORKSPACE_MEMBERSHIP_NOT_FOUND",
      );

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

    console.log(
      "INSTAGRAM_MEMBERSHIP_OK",
    );

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
        "INSTAGRAM_WORKSPACE_NOT_AVAILABLE",
        {
          workspaceFound:
            Boolean(
              workspace,
            ),
          workspaceStatus:
            workspace?.status ??
            null,
        },
      );

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

    console.log(
      "INSTAGRAM_WORKSPACE_OK",
      {
        workspaceType:
          workspace.type,
      },
    );

    const requestedCreatorId =
      request.nextUrl.searchParams.get(
        "creatorId",
      );

    console.log(
      "INSTAGRAM_CREATOR_LOOKUP_START",
      {
        explicitCreator:
          Boolean(
            requestedCreatorId,
          ),
      },
    );

    let creator = null;

    if (
      requestedCreatorId
    ) {
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
          "INSTAGRAM_CREATOR_NOT_FOUND",
        );

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
      console.error(
        "INSTAGRAM_CREATOR_REQUIRED",
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "CREATOR_REQUIRED",
          message:
            "A creator must exist before connecting Instagram.",
        },
        {
          status: 400,
        },
      );
    }

    console.log(
      "INSTAGRAM_CREATOR_OK",
    );

    const state =
      base64UrlEncode(
        randomBytes(32),
      );

    console.log(
      "INSTAGRAM_STATE_CREATED",
      {
        stateLength:
          state.length,
      },
    );

    const authorizationUrl =
      new URL(
        INSTAGRAM_AUTHORIZATION_URL,
      );

    authorizationUrl.searchParams.set(
      "force_reauth",
      "true",
    );

    authorizationUrl.searchParams.set(
      "enable_fb_login",
      "0",
    );

    authorizationUrl.searchParams.set(
      "client_id",
      clientId,
    );

    authorizationUrl.searchParams.set(
      "redirect_uri",
      redirectUri,
    );

    authorizationUrl.searchParams.set(
      "response_type",
      "code",
    );

    authorizationUrl.searchParams.set(
      "scope",
      INSTAGRAM_SCOPES.join(
        ",",
      ),
    );

    authorizationUrl.searchParams.set(
      "state",
      state,
    );

    console.log(
      "INSTAGRAM_AUTH_URL_CREATED",
      {
        authorizationHost:
          authorizationUrl.host,
        redirectUri,
        scopes:
          INSTAGRAM_SCOPES,
      },
    );

    const response =
      NextResponse.redirect(
        authorizationUrl,
      );

    const isProduction =
      process.env.NODE_ENV ===
      "production";

    const cookieOptions = {
      httpOnly: true,
      secure:
        isProduction,
      sameSite:
        "lax" as const,
      path: "/",
      maxAge:
        10 * 60,
    };

    response.cookies.set(
      OAUTH_STATE_COOKIE,
      state,
      cookieOptions,
    );

    response.cookies.set(
      OAUTH_CREATOR_COOKIE,
      creator.id,
      cookieOptions,
    );

    response.cookies.set(
      OAUTH_LOCALE_COOKIE,
      locale,
      cookieOptions,
    );

    response.cookies.set(
      OAUTH_RETURN_TO_COOKIE,
      returnTo,
      cookieOptions,
    );

    console.log(
      "INSTAGRAM_OAUTH_COOKIES_SET",
      {
        secure:
          cookieOptions.secure,
        sameSite:
          cookieOptions.sameSite,
        path:
          cookieOptions.path,
        maxAge:
          cookieOptions.maxAge,
        locale,
        returnTo,
      },
    );

    console.log(
      "INSTAGRAM_REDIRECT_READY",
      {
        target:
          authorizationUrl.origin,
      },
    );

    return response;
  } catch (error) {
    console.error(
      "INSTAGRAM_OAUTH_CONNECT_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_SERVER_ERROR",
        message:
          "Unable to start Instagram connection.",
      },
      {
        status: 500,
      },
    );
  }
}
