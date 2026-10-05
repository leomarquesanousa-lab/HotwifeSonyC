import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/src/lib/auth/session";
import { db } from "@/src/prisma/db";

type FacebookTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type FacebookPage = {
  id?: string;
  name?: string;
  access_token?: string;
  category?: string;
  tasks?: string[];
};

type FacebookPagesResponse = {
  data?: FacebookPage[];
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

const FACEBOOK_TOKEN_URL =
  "https://graph.facebook.com/oauth/access_token";

const FACEBOOK_PAGES_URL =
  "https://graph.facebook.com/me/accounts";

class FacebookConnectionError extends Error {
  reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "FacebookConnectionError";
    this.reason = reason;
  }
}

function getBaseUrl(request: NextRequest) {
  const configuredUrl =
    process.env.APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(
      /\/+$/,
      "",
    );
  }

  return request.nextUrl.origin;
}

function redirectToPlatforms(
  request: NextRequest,
  status: "connected" | "error",
  reason?: string,
) {
  const url = new URL(
    "/en-US/onboarding/platforms",
    getBaseUrl(request),
  );

  url.searchParams.set(
    "facebook",
    status,
  );

  if (reason) {
    url.searchParams.set(
      "reason",
      reason,
    );
  }

  const response =
    NextResponse.redirect(url);

  response.cookies.set(
    "facebook_oauth_state",
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  );

  response.cookies.set(
    "facebook_oauth_creator",
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  );

  return response;
}

function getEncryptionKey() {
  const rawKey =
    process.env
      .PLATFORM_TOKEN_ENCRYPTION_KEY
      ?.trim() ||
    process.env
      .FANVUE_TOKEN_ENCRYPTION_KEY
      ?.trim();

  if (!rawKey) {
    throw new FacebookConnectionError(
      "token_encryption",
    );
  }

  const key =
    Buffer.from(rawKey, "hex");

  if (key.length !== 32) {
    throw new FacebookConnectionError(
      "token_encryption",
    );
  }

  return key;
}

function encryptToken(
  value: string,
) {
  const key =
    getEncryptionKey();

  const iv =
    crypto.randomBytes(12);

  const cipher =
    crypto.createCipheriv(
      "aes-256-gcm",
      key,
      iv,
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        value,
        "utf8",
      ),
      cipher.final(),
    ]);

  const authTag =
    cipher.getAuthTag();

  return [
    "v1",
    iv.toString(
      "base64url",
    ),
    authTag.toString(
      "base64url",
    ),
    encrypted.toString(
      "base64url",
    ),
  ].join(".");
}

async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string,
  appId: string,
  appSecret: string,
) {
  const url =
    new URL(
      FACEBOOK_TOKEN_URL,
    );

  url.searchParams.set(
    "client_id",
    appId,
  );

  url.searchParams.set(
    "client_secret",
    appSecret,
  );

  url.searchParams.set(
    "redirect_uri",
    redirectUri,
  );

  url.searchParams.set(
    "code",
    code,
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",
        cache: "no-store",
      },
    );

  const data =
    (await response.json()) as FacebookTokenResponse;

  if (
    !response.ok ||
    !data.access_token
  ) {
    console.error(
      "FACEBOOK_TOKEN_EXCHANGE_FAILED",
      {
        status:
          response.status,
        error:
          data.error,
      },
    );

    throw new FacebookConnectionError(
      "token_exchange",
    );
  }

  return data;
}

async function exchangeLongLivedToken(
  accessToken: string,
  appId: string,
  appSecret: string,
) {
  const url =
    new URL(
      FACEBOOK_TOKEN_URL,
    );

  url.searchParams.set(
    "grant_type",
    "fb_exchange_token",
  );

  url.searchParams.set(
    "client_id",
    appId,
  );

  url.searchParams.set(
    "client_secret",
    appSecret,
  );

  url.searchParams.set(
    "fb_exchange_token",
    accessToken,
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",
        cache: "no-store",
      },
    );

  const data =
    (await response.json()) as FacebookTokenResponse;

  if (
    !response.ok ||
    !data.access_token
  ) {
    console.error(
      "FACEBOOK_LONG_LIVED_TOKEN_FAILED",
      {
        status:
          response.status,
        error:
          data.error,
      },
    );

    throw new FacebookConnectionError(
      "long_token_exchange",
    );
  }

  return data;
}

async function getFacebookPages(
  userAccessToken: string,
) {
  const url =
    new URL(
      FACEBOOK_PAGES_URL,
    );

  url.searchParams.set(
    "fields",
    [
      "id",
      "name",
      "access_token",
      "category",
      "tasks",
    ].join(","),
  );

  url.searchParams.set(
    "access_token",
    userAccessToken,
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",
        cache: "no-store",
      },
    );

  const data =
    (await response.json()) as FacebookPagesResponse;

  if (
    !response.ok ||
    data.error
  ) {
    console.error(
      "FACEBOOK_PAGES_FETCH_FAILED",
      {
        status:
          response.status,
        error:
          data.error,
      },
    );

    throw new FacebookConnectionError(
      "pages_fetch",
    );
  }

  return data.data ?? [];
}

export async function GET(
  request: NextRequest,
) {
  try {
    const session =
      await getCurrentSession();

    if (!session) {
      return NextResponse.redirect(
        new URL(
          "/en-US/login",
          getBaseUrl(request),
        ),
      );
    }

    const providerError =
      request.nextUrl.searchParams.get(
        "error",
      );

    if (providerError) {
      console.error(
        "FACEBOOK_OAUTH_PROVIDER_ERROR",
        {
          error:
            providerError,
          errorDescription:
            request.nextUrl.searchParams.get(
              "error_description",
            ),
          errorReason:
            request.nextUrl.searchParams.get(
              "error_reason",
            ),
        },
      );

      return redirectToPlatforms(
        request,
        "error",
        "denied",
      );
    }

    const code =
      request.nextUrl.searchParams.get(
        "code",
      );

    const returnedState =
      request.nextUrl.searchParams.get(
        "state",
      );

    const storedState =
      request.cookies.get(
        "facebook_oauth_state",
      )?.value;

    const creatorId =
      request.cookies.get(
        "facebook_oauth_creator",
      )?.value;

    if (!code) {
      console.error(
        "FACEBOOK_OAUTH_CODE_MISSING",
      );

      return redirectToPlatforms(
        request,
        "error",
        "code",
      );
    }

    if (
      !returnedState ||
      !storedState ||
      returnedState !==
        storedState
    ) {
      console.error(
        "FACEBOOK_OAUTH_STATE_INVALID",
      );

      return redirectToPlatforms(
        request,
        "error",
        "state",
      );
    }

    if (!creatorId) {
      console.error(
        "FACEBOOK_CREATOR_COOKIE_MISSING",
      );

      return redirectToPlatforms(
        request,
        "error",
        "creator",
      );
    }

    const appId =
      process.env
        .FACEBOOK_APP_ID
        ?.trim();

    const appSecret =
      process.env
        .FACEBOOK_APP_SECRET
        ?.trim();

    if (
      !appId ||
      !appSecret
    ) {
      console.error(
        "FACEBOOK_CONFIG_MISSING",
      );

      return redirectToPlatforms(
        request,
        "error",
        "config",
      );
    }

    const redirectUri =
      process.env
        .FACEBOOK_REDIRECT_URI
        ?.trim() ||
      `${getBaseUrl(
        request,
      )}/api/platforms/facebook/callback`;

    const workspaceMember =
      await db.orm.public.WorkspaceMember.where({
        userId:
          session.user.id,
      }).first();

    if (!workspaceMember) {
      console.error(
        "FACEBOOK_WORKSPACE_MEMBER_NOT_FOUND",
      );

      return redirectToPlatforms(
        request,
        "error",
        "workspace",
      );
    }

    const creator =
      await db.orm.public.Creator.where({
        id:
          creatorId,
        workspaceId:
          workspaceMember.workspaceId,
      }).first();

    if (!creator) {
      console.error(
        "FACEBOOK_CREATOR_NOT_FOUND",
      );

      return redirectToPlatforms(
        request,
        "error",
        "creator",
      );
    }

    const shortToken =
      await exchangeAuthorizationCode(
        code,
        redirectUri,
        appId,
        appSecret,
      );

    const longToken =
      await exchangeLongLivedToken(
        shortToken.access_token!,
        appId,
        appSecret,
      );

    const pages =
      await getFacebookPages(
        longToken.access_token!,
      );

    const usablePages =
      pages.filter(
        (
          page,
        ): page is FacebookPage & {
          id: string;
          access_token: string;
        } =>
          typeof page.id ===
            "string" &&
          page.id.length > 0 &&
          typeof page.access_token ===
            "string" &&
          page.access_token.length >
            0,
      );

    if (
      usablePages.length === 0
    ) {
      console.error(
        "FACEBOOK_NO_MANAGED_PAGES",
      );

      return redirectToPlatforms(
        request,
        "error",
        "no_pages",
      );
    }

    const now =
      new Date().toISOString();

    for (
      const page of usablePages
    ) {
      const encryptedPageToken =
        encryptToken(
          page.access_token,
        );

      const existingAccount =
        await db.orm.public.PlatformAccount.where({
          workspaceId:
            workspaceMember.workspaceId,
          creatorId:
            creator.id,
          platform:
            "FACEBOOK",
          externalAccountId:
            page.id,
        }).first();

      if (existingAccount) {
        await db.orm.public.PlatformAccount.where({
          id:
            existingAccount.id,
        }).update({
          status:
            "CONNECTED",
          externalAccountId:
            page.id,
          externalUsername:
            page.name ?? null,
          externalDisplayName:
            page.name ?? null,
          connectionType:
            "OAUTH",
          accessTokenEncrypted:
            encryptedPageToken,
          refreshTokenEncrypted:
            null,
          tokenExpiresAt:
            null,
          lastVerifiedAt:
            now,
          lastSyncAt:
            now,
          lastErrorCode:
            null,
          lastErrorMessage:
            null,
        });

        continue;
      }

      await db.orm.public.PlatformAccount.create({
        workspaceId:
          workspaceMember.workspaceId,
        creatorId:
          creator.id,
        platform:
          "FACEBOOK",
        status:
          "CONNECTED",
        externalAccountId:
          page.id,
        externalUsername:
          page.name ?? null,
        externalDisplayName:
          page.name ?? null,
        connectionType:
          "OAUTH",
        accessTokenEncrypted:
          encryptedPageToken,
        refreshTokenEncrypted:
          null,
        tokenExpiresAt:
          null,
        lastVerifiedAt:
          now,
        lastSyncAt:
          now,
        lastErrorCode:
          null,
        lastErrorMessage:
          null,
      });
    }

    console.log(
      "FACEBOOK_CONNECTED",
      {
        creatorId:
          creator.id,
        pageCount:
          usablePages.length,
      },
    );

    return redirectToPlatforms(
      request,
      "connected",
    );
  } catch (error) {
    console.error(
      "FACEBOOK_CALLBACK_ERROR",
      error,
    );

    if (
      error instanceof FacebookConnectionError
    ) {
      return redirectToPlatforms(
        request,
        "error",
        error.reason,
      );
    }

    return redirectToPlatforms(
      request,
      "error",
      "server",
    );
  }
}
