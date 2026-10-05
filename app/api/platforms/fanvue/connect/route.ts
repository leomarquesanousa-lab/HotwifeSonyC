import {
  createHash,
  randomBytes,
} from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getCurrentSession } from "../../../../../src/lib/auth/session";
import { db } from "../../../../../src/prisma/db";

const FANVUE_AUTHORIZATION_URL =
  "https://auth.fanvue.com/oauth2/auth";

const FANVUE_SCOPES = [
  "openid",
  "offline_access",
  "offline",
  "read:self",
  "read:creator",
  "read:media",
  "write:media",
  "read:insights",
];

const OAUTH_STATE_COOKIE =
  "fanvue_oauth_state";

const OAUTH_VERIFIER_COOKIE =
  "fanvue_oauth_verifier";

const OAUTH_CREATOR_COOKIE =
  "fanvue_oauth_creator";

function base64UrlEncode(
  buffer: Buffer,
) {
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function generateCodeVerifier() {
  return base64UrlEncode(
    randomBytes(32),
  );
}

function generateCodeChallenge(
  verifier: string,
) {
  return base64UrlEncode(
    createHash("sha256")
      .update(verifier)
      .digest(),
  );
}

export async function GET(
  request: NextRequest,
) {
  console.log(
    "FANVUE_CONNECT_START",
    {
      environment:
        process.env.NODE_ENV,
      host:
        request.headers.get("host"),
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
    const auth =
      await getCurrentSession();

    if (!auth) {
      console.error(
        "FANVUE_CONNECT_UNAUTHORIZED",
      );

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

    console.log(
      "FANVUE_SESSION_OK",
    );

    const clientId =
      process.env.FANVUE_CLIENT_ID;

    const redirectUri =
      process.env.FANVUE_REDIRECT_URI;

    console.log(
      "FANVUE_ENV_CHECK",
      {
        hasClientId: Boolean(
          clientId,
        ),
        hasRedirectUri: Boolean(
          redirectUri,
        ),
        redirectUri:
          redirectUri ?? null,
      },
    );

    if (
      !clientId ||
      !redirectUri
    ) {
      console.error(
        "FANVUE_OAUTH_CONFIG_MISSING",
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "FANVUE_CONFIGURATION_ERROR",
          message:
            "Fanvue integration is not configured.",
        },
        {
          status: 500,
        },
      );
    }

    console.log(
      "FANVUE_ENV_OK",
    );

    const membership =
      await db.orm.public.WorkspaceMember
        .where({
          userId: auth.user.id,
        })
        .first();

    if (!membership) {
      console.error(
        "FANVUE_WORKSPACE_MEMBERSHIP_NOT_FOUND",
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
      "FANVUE_MEMBERSHIP_OK",
    );

    const workspace =
      await db.orm.public.Workspace
        .where({
          id: membership.workspaceId,
        })
        .first();

    if (
      !workspace ||
      workspace.status !== "ACTIVE"
    ) {
      console.error(
        "FANVUE_WORKSPACE_NOT_AVAILABLE",
        {
          workspaceFound:
            Boolean(workspace),
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
      "FANVUE_WORKSPACE_OK",
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
      "FANVUE_CREATOR_LOOKUP_START",
      {
        explicitCreator:
          Boolean(
            requestedCreatorId,
          ),
      },
    );

    let creator = null;

    if (requestedCreatorId) {
      creator =
        await db.orm.public.Creator
          .where({
            id: requestedCreatorId,
            workspaceId:
              workspace.id,
          })
          .first();

      if (!creator) {
        console.error(
          "FANVUE_CREATOR_NOT_FOUND",
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
        "FANVUE_CREATOR_REQUIRED",
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "CREATOR_REQUIRED",
          message:
            "A creator must exist before connecting Fanvue.",
        },
        {
          status: 400,
        },
      );
    }

    console.log(
      "FANVUE_CREATOR_OK",
    );

    const state =
      base64UrlEncode(
        randomBytes(32),
      );

    console.log(
      "FANVUE_STATE_CREATED",
      {
        stateLength:
          state.length,
      },
    );

    const codeVerifier =
      generateCodeVerifier();

    const codeChallenge =
      generateCodeChallenge(
        codeVerifier,
      );

    console.log(
      "FANVUE_PKCE_CREATED",
      {
        verifierLength:
          codeVerifier.length,
        challengeLength:
          codeChallenge.length,
      },
    );

    const authorizationUrl =
      new URL(
        FANVUE_AUTHORIZATION_URL,
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
      FANVUE_SCOPES.join(" "),
    );

    authorizationUrl.searchParams.set(
      "state",
      state,
    );

    authorizationUrl.searchParams.set(
      "code_challenge",
      codeChallenge,
    );

    authorizationUrl.searchParams.set(
      "code_challenge_method",
      "S256",
    );

    console.log(
      "FANVUE_AUTH_URL_CREATED",
      {
        authorizationHost:
          authorizationUrl.host,
        redirectUri,
        scopes:
          FANVUE_SCOPES,
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
      secure: isProduction,
      sameSite:
        "lax" as const,
      path: "/",
      maxAge: 10 * 60,
    };

    response.cookies.set(
      OAUTH_STATE_COOKIE,
      state,
      cookieOptions,
    );

    response.cookies.set(
      OAUTH_VERIFIER_COOKIE,
      codeVerifier,
      cookieOptions,
    );

    response.cookies.set(
      OAUTH_CREATOR_COOKIE,
      creator.id,
      cookieOptions,
    );

    console.log(
      "FANVUE_OAUTH_COOKIES_SET",
      {
        secure:
          cookieOptions.secure,
        sameSite:
          cookieOptions.sameSite,
        path:
          cookieOptions.path,
        maxAge:
          cookieOptions.maxAge,
      },
    );

    console.log(
      "FANVUE_REDIRECT_READY",
      {
        target:
          authorizationUrl.origin,
      },
    );

    return response;
  } catch (error) {
    console.error(
      "FANVUE_OAUTH_CONNECT_ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_SERVER_ERROR",
        message:
          "Unable to start Fanvue connection.",
      },
      {
        status: 500,
      },
    );
  }
}