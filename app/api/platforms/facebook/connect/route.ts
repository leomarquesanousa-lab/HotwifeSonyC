import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/src/lib/auth/session";
import { db } from "@/src/prisma/db";

const FACEBOOK_AUTHORIZATION_URL =
  "https://www.facebook.com/dialog/oauth";

const FACEBOOK_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
];

function getBaseUrl(request: NextRequest) {
  const configuredUrl = process.env.APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.redirect(
        new URL("/login", getBaseUrl(request)),
      );
    }

    const appId = process.env.FACEBOOK_APP_ID?.trim();

    if (!appId) {
      console.error("FACEBOOK_APP_ID_MISSING");

      return NextResponse.redirect(
        new URL(
          "/onboarding/platforms?facebook=error&reason=config",
          getBaseUrl(request),
        ),
      );
    }

    const redirectUri =
      process.env.FACEBOOK_REDIRECT_URI?.trim() ||
      `${getBaseUrl(
        request,
      )}/api/platforms/facebook/callback`;

    const workspaceMember =
      await db.orm.public.WorkspaceMember.where({
        userId: session.user.id,
      }).first();

    if (!workspaceMember) {
      console.error(
        "FACEBOOK_WORKSPACE_MEMBER_NOT_FOUND",
      );

      return NextResponse.redirect(
        new URL(
          "/onboarding/platforms?facebook=error&reason=workspace",
          getBaseUrl(request),
        ),
      );
    }

    const creator =
      await db.orm.public.Creator.where({
        workspaceId: workspaceMember.workspaceId,
      }).first();

    if (!creator) {
      console.error("FACEBOOK_CREATOR_NOT_FOUND");

      return NextResponse.redirect(
        new URL(
          "/onboarding/platforms?facebook=error&reason=creator",
          getBaseUrl(request),
        ),
      );
    }

    const state = crypto.randomBytes(32).toString("hex");

    const authorizationUrl = new URL(
      FACEBOOK_AUTHORIZATION_URL,
    );

    authorizationUrl.searchParams.set(
      "client_id",
      appId,
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
      FACEBOOK_SCOPES.join(","),
    );

    authorizationUrl.searchParams.set(
      "state",
      state,
    );

    const response = NextResponse.redirect(
      authorizationUrl,
    );

    response.cookies.set(
      "facebook_oauth_state",
      state,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 10 * 60,
      },
    );

    response.cookies.set(
      "facebook_oauth_creator",
      creator.id,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 10 * 60,
      },
    );

    return response;
  } catch (error) {
    console.error(
      "FACEBOOK_CONNECT_ERROR",
      error,
    );

    return NextResponse.redirect(
      new URL(
        "/onboarding/platforms?facebook=error&reason=server",
        getBaseUrl(request),
      ),
    );
  }
}