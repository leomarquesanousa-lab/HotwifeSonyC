import {
  createCipheriv,
  randomBytes,
} from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { db } from "../../../../../src/prisma/db";

const FANVUE_TOKEN_URL =
  "https://auth.fanvue.com/oauth2/token";

const FANVUE_API_URL =
  "https://api.fanvue.com";

const OAUTH_STATE_COOKIE =
  "fanvue_oauth_state";

const OAUTH_VERIFIER_COOKIE =
  "fanvue_oauth_verifier";

const OAUTH_CREATOR_COOKIE =
  "fanvue_oauth_creator";

type FanvueTokenResponse = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type UnknownRecord = Record<
  string,
  unknown
>;

function getEncryptionKey() {
  const rawKey =
    process.env
      .FANVUE_TOKEN_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error(
      "FANVUE_TOKEN_ENCRYPTION_KEY is missing.",
    );
  }

  const key = Buffer.from(
    rawKey,
    "hex",
  );

  if (key.length !== 32) {
    throw new Error(
      "FANVUE_TOKEN_ENCRYPTION_KEY must be a 32-byte hexadecimal key.",
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
    randomBytes(12);

  const cipher =
    createCipheriv(
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
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function stringValue(
  value: unknown,
) {
  return typeof value ===
    "string"
    ? value
    : null;
}

function getProfileData(
  data: unknown,
) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return {
      id: null,
      username: null,
      displayName: null,
    };
  }

  const record =
    data as UnknownRecord;

  const possibleUser =
    record.user &&
    typeof record.user ===
      "object"
      ? (record.user as UnknownRecord)
      : record;

  const id =
    stringValue(
      possibleUser.uuid,
    ) ??
    stringValue(
      possibleUser.id,
    ) ??
    stringValue(
      possibleUser.userId,
    );

  const username =
    stringValue(
      possibleUser.username,
    ) ??
    stringValue(
      possibleUser.handle,
    );

  const displayName =
    stringValue(
      possibleUser.displayName,
    ) ??
    stringValue(
      possibleUser.display_name,
    ) ??
    stringValue(
      possibleUser.name,
    );

  return {
    id,
    username,
    displayName,
  };
}

function clearOAuthCookies(
  response: NextResponse,
) {
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    "",
    {
      path: "/",
      maxAge: 0,
    },
  );

  response.cookies.set(
    OAUTH_VERIFIER_COOKIE,
    "",
    {
      path: "/",
      maxAge: 0,
    },
  );

  response.cookies.set(
    OAUTH_CREATOR_COOKIE,
    "",
    {
      path: "/",
      maxAge: 0,
    },
  );

  return response;
}

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
  status:
    | "connected"
    | "error",
  reason?: string,
) {
  const appUrl =
    getAppUrl();

  const url = new URL(
    "/onboarding/platforms",
    appUrl,
  );

  url.searchParams.set(
    "fanvue",
    status,
  );

  if (reason) {
    url.searchParams.set(
      "reason",
      reason,
    );
  }

  return clearOAuthCookies(
    NextResponse.redirect(url),
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    const code =
      request.nextUrl.searchParams.get(
        "code",
      );

    const returnedState =
      request.nextUrl.searchParams.get(
        "state",
      );

    const oauthError =
      request.nextUrl.searchParams.get(
        "error",
      );

    const oauthErrorDescription =
      request.nextUrl.searchParams.get(
        "error_description",
      );

    const storedState =
      request.cookies.get(
        OAUTH_STATE_COOKIE,
      )?.value;

    const codeVerifier =
      request.cookies.get(
        OAUTH_VERIFIER_COOKIE,
      )?.value;

    const creatorId =
      request.cookies.get(
        OAUTH_CREATOR_COOKIE,
      )?.value;

    if (oauthError) {
      console.error(
        "FANVUE_OAUTH_DENIED",
        {
          error:
            oauthError,
          description:
            oauthErrorDescription,
        },
      );

      return redirectWithStatus(
        "error",
        "authorization_denied",
      );
    }

    if (
      !returnedState ||
      !storedState ||
      returnedState !==
        storedState
    ) {
      console.error(
        "FANVUE_OAUTH_STATE_INVALID",
      );

      return redirectWithStatus(
        "error",
        "invalid_state",
      );
    }

    if (!code) {
      return redirectWithStatus(
        "error",
        "missing_code",
      );
    }

    if (!codeVerifier) {
      return redirectWithStatus(
        "error",
        "missing_verifier",
      );
    }

    if (!creatorId) {
      return redirectWithStatus(
        "error",
        "missing_creator",
      );
    }

    const clientId =
      process.env
        .FANVUE_CLIENT_ID;

    const clientSecret =
      process.env
        .FANVUE_CLIENT_SECRET;

    const redirectUri =
      process.env
        .FANVUE_REDIRECT_URI;

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      console.error(
        "FANVUE_OAUTH_CONFIG_MISSING",
      );

      return redirectWithStatus(
        "error",
        "configuration",
      );
    }

    const creator =
      await db.orm.public.Creator
        .where({
          id: creatorId,
        })
        .first();

    if (!creator) {
      return redirectWithStatus(
        "error",
        "creator_not_found",
      );
    }

    const basicCredentials =
      Buffer.from(
        `${clientId}:${clientSecret}`,
        "utf8",
      ).toString("base64");

    const tokenBody =
      new URLSearchParams();

    tokenBody.set(
      "grant_type",
      "authorization_code",
    );

    tokenBody.set(
      "code",
      code,
    );

    tokenBody.set(
      "redirect_uri",
      redirectUri,
    );

    tokenBody.set(
      "code_verifier",
      codeVerifier,
    );

    const tokenResponse =
      await fetch(
        FANVUE_TOKEN_URL,
        {
          method: "POST",
          headers: {
            Authorization:
              `Basic ${basicCredentials}`,
            "Content-Type":
              "application/x-www-form-urlencoded",
            Accept:
              "application/json",
          },
          body:
            tokenBody.toString(),
          cache:
            "no-store",
        },
      );

    if (!tokenResponse.ok) {
      const errorText =
        await tokenResponse.text();

      console.error(
        "FANVUE_TOKEN_EXCHANGE_FAILED",
        {
          status:
            tokenResponse.status,
          response:
            errorText,
        },
      );

      return redirectWithStatus(
        "error",
        "token_exchange",
      );
    }

    const tokens =
      (await tokenResponse.json()) as FanvueTokenResponse;

    if (
      !tokens.access_token
    ) {
      console.error(
        "FANVUE_ACCESS_TOKEN_MISSING",
      );

      return redirectWithStatus(
        "error",
        "missing_access_token",
      );
    }

    const profileResponse =
      await fetch(
        `${FANVUE_API_URL}/users/me`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${tokens.access_token}`,
            Accept:
              "application/json",
          },
          cache:
            "no-store",
        },
      );

    if (
      !profileResponse.ok
    ) {
      const profileError =
        await profileResponse.text();

      console.error(
        "FANVUE_PROFILE_CHECK_FAILED",
        {
          status:
            profileResponse.status,
          response:
            profileError,
        },
      );

      return redirectWithStatus(
        "error",
        "profile_check",
      );
    }

    const profileJson =
      await profileResponse.json();

    const profile =
      getProfileData(
        profileJson,
      );

    console.log(
      "FANVUE_PROFILE_MAPPED",
      {
        hasId:
          Boolean(profile.id),
        username:
          profile.username,
        displayName:
          profile.displayName,
      },
    );

    if (!profile.id) {
      console.error(
        "FANVUE_PROFILE_ID_MISSING",
        profileJson,
      );

      return redirectWithStatus(
        "error",
        "invalid_profile",
      );
    }

    const encryptedAccessToken =
      encryptToken(
        tokens.access_token,
      );

    const encryptedRefreshToken =
      tokens.refresh_token
        ? encryptToken(
            tokens.refresh_token,
          )
        : null;

    const expiresIn =
      typeof tokens.expires_in ===
        "number"
        ? tokens.expires_in
        : 3600;

    const tokenExpiresAt =
      new Date(
        Date.now() +
          expiresIn * 1000,
      ).toISOString();

    const now =
      new Date().toISOString();

    const existingAccount =
      await db.orm.public.PlatformAccount
        .where({
          workspaceId:
            creator.workspaceId,
          creatorId:
            creator.id,
          platform:
            "FANVUE",
          externalAccountId:
            profile.id,
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
          externalUsername:
            profile.username,
          externalDisplayName:
            profile.displayName,
          connectionType:
            "OAUTH",
          accessTokenEncrypted:
            encryptedAccessToken,
          refreshTokenEncrypted:
            encryptedRefreshToken,
          tokenExpiresAt,
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
            creator.workspaceId,
          creatorId:
            creator.id,
          platform:
            "FANVUE",
          status:
            "CONNECTED",
          externalAccountId:
            profile.id,
          externalUsername:
            profile.username,
          externalDisplayName:
            profile.displayName,
          connectionType:
            "OAUTH",
          accessTokenEncrypted:
            encryptedAccessToken,
          refreshTokenEncrypted:
            encryptedRefreshToken,
          tokenExpiresAt,
          lastVerifiedAt:
            now,
          lastSyncAt:
            now,
        });
    }

    console.log(
      "FANVUE_CONNECTED",
      {
        creatorId:
          creator.id,
        workspaceId:
          creator.workspaceId,
        externalAccountId:
          profile.id,
      },
    );

    return redirectWithStatus(
      "connected",
    );
  } catch (error) {
    console.error(
      "FANVUE_OAUTH_CALLBACK_ERROR",
      error,
    );

    try {
      return redirectWithStatus(
        "error",
        "internal",
      );
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "FANVUE_CALLBACK_FAILED",
        },
        {
          status: 500,
        },
      );
    }
  }
}