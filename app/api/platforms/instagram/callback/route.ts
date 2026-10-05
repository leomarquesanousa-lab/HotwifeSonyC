import {
  createCipheriv,
  randomBytes,
} from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { db } from "../../../../../src/prisma/db";

const INSTAGRAM_TOKEN_URL =
  "https://api.instagram.com/oauth/access_token";

const INSTAGRAM_GRAPH_BASE_URL =
  "https://graph.instagram.com";

function getInstagramApiVersion() {
  const value =
    process.env
      .INSTAGRAM_GRAPH_API_VERSION
      ?.trim();

  if (!value) {
    throw new Error(
      "INSTAGRAM_GRAPH_API_VERSION_MISSING",
    );
  }

  return value.startsWith(
    "v",
  )
    ? value
    : `v${value}`;
}

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
  value: string | null | undefined,
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

type InstagramShortToken = {
  access_token: string;
  user_id?: string;
  permissions?: string;
};

type InstagramLongToken = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type InstagramProfile = {
  id?: string;
  user_id?: string;
  username?: string;
  account_type?: string;
  profile_picture_url?: string;
};

type UnknownRecord = Record<
  string,
  unknown
>;

function getEncryptionKey() {
  const rawKey =
    process.env
      .PLATFORM_TOKEN_ENCRYPTION_KEY ??
    process.env
      .FANVUE_TOKEN_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error(
      "Platform token encryption key is missing.",
    );
  }

  const key =
    Buffer.from(
      rawKey,
      "hex",
    );

  if (
    key.length !== 32
  ) {
    throw new Error(
      "Platform token encryption key must be a 32-byte hexadecimal key.",
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
    OAUTH_CREATOR_COOKIE,
    "",
    {
      path: "/",
      maxAge: 0,
    },
  );

  response.cookies.set(
    OAUTH_LOCALE_COOKIE,
    "",
    {
      path: "/",
      maxAge: 0,
    },
  );

  response.cookies.set(
    OAUTH_RETURN_TO_COOKIE,
    "",
    {
      path: "/",
      maxAge: 0,
    },
  );

  return response;
}

function redirectWithStatus(
  status:
    | "connected"
    | "error",
  reason: string | undefined,
  locale: SupportedLocale,
) {
  const appUrl =
    getAppUrl();

  const pathname =
    `/${locale}/app/platforms`;

  const url =
    new URL(
      pathname,
      appUrl,
    );

  url.searchParams.set(
    "instagram",
    status,
  );

  if (reason) {
    url.searchParams.set(
      "reason",
      reason,
    );
  }

  return clearOAuthCookies(
    NextResponse.redirect(
      url,
    ),
  );
}

function stringValue(
  value: unknown,
) {
  if (
    typeof value ===
    "string"
  ) {
    return value;
  }

  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
  ) {
    return String(
      value,
    );
  }

  return null;
}

function parseShortTokenResponse(
  data: unknown,
): InstagramShortToken | null {
  if (
    !data ||
    typeof data !==
      "object"
  ) {
    return null;
  }

  const record =
    data as UnknownRecord;

  let tokenRecord:
    UnknownRecord = record;

  if (
    Array.isArray(
      record.data,
    ) &&
    record.data.length >
      0 &&
    record.data[0] &&
    typeof record.data[0] ===
      "object"
  ) {
    tokenRecord =
      record.data[0] as UnknownRecord;
  }

  const accessToken =
    stringValue(
      tokenRecord.access_token,
    );

  if (!accessToken) {
    return null;
  }

  const userId =
    stringValue(
      tokenRecord.user_id,
    );

  const permissions =
    stringValue(
      tokenRecord.permissions,
    );

  return {
    access_token:
      accessToken,
    user_id:
      userId ??
      undefined,
    permissions:
      permissions ??
      undefined,
  };
}

function parseLongTokenResponse(
  data: unknown,
): InstagramLongToken | null {
  if (
    !data ||
    typeof data !==
      "object"
  ) {
    return null;
  }

  const record =
    data as UnknownRecord;

  const accessToken =
    stringValue(
      record.access_token,
    );

  if (!accessToken) {
    return null;
  }

  const expiresIn =
    typeof record.expires_in ===
      "number"
      ? record.expires_in
      : undefined;

  return {
    access_token:
      accessToken,
    token_type:
      stringValue(
        record.token_type,
      ) ?? undefined,
    expires_in:
      expiresIn,
  };
}

function parseProfile(
  data: unknown,
): InstagramProfile | null {
  if (
    !data ||
    typeof data !==
      "object"
  ) {
    return null;
  }

  const record =
    data as UnknownRecord;

  const id =
    stringValue(
      record.id,
    ) ??
    stringValue(
      record.user_id,
    );

  if (!id) {
    return null;
  }

  return {
    id,
    user_id:
      stringValue(
        record.user_id,
      ) ?? undefined,
    username:
      stringValue(
        record.username,
      ) ?? undefined,
    account_type:
      stringValue(
        record.account_type,
      ) ?? undefined,
    profile_picture_url:
      stringValue(
        record.profile_picture_url,
      ) ?? undefined,
  };
}

export async function GET(
  request: NextRequest,
) {
  console.log(
    "INSTAGRAM_CALLBACK_START",
    {
      environment:
        process.env.NODE_ENV,
      host:
        request.headers.get(
          "host",
        ),
      hasStateCookie:
        request.cookies.has(
          OAUTH_STATE_COOKIE,
        ),
      hasCreatorCookie:
        request.cookies.has(
          OAUTH_CREATOR_COOKIE,
        ),
    },
  );

  try {
    const locale =
      normalizeLocale(
        request.cookies.get(
          OAUTH_LOCALE_COOKIE,
        )?.value,
      );

    const redirectToApp = (
      status:
        | "connected"
        | "error",
      reason?: string,
    ) =>
      redirectWithStatus(
        status,
        reason,
        locale,
      );

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

    const oauthErrorReason =
      request.nextUrl.searchParams.get(
        "error_reason",
      );

    const oauthErrorDescription =
      request.nextUrl.searchParams.get(
        "error_description",
      );

    const storedState =
      request.cookies.get(
        OAUTH_STATE_COOKIE,
      )?.value;

    const creatorId =
      request.cookies.get(
        OAUTH_CREATOR_COOKIE,
      )?.value;

    if (oauthError) {
      console.error(
        "INSTAGRAM_OAUTH_DENIED",
        {
          error:
            oauthError,
          reason:
            oauthErrorReason,
          description:
            oauthErrorDescription,
        },
      );

      return redirectToApp(
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
        "INSTAGRAM_OAUTH_STATE_INVALID",
      );

      return redirectToApp(
        "error",
        "invalid_state",
      );
    }

    if (!code) {
      console.error(
        "INSTAGRAM_CODE_MISSING",
      );

      return redirectToApp(
        "error",
        "missing_code",
      );
    }

    if (!creatorId) {
      console.error(
        "INSTAGRAM_CREATOR_COOKIE_MISSING",
      );

      return redirectToApp(
        "error",
        "missing_creator",
      );
    }

    const clientId =
      process.env
        .INSTAGRAM_APP_ID;

    const clientSecret =
      process.env
        .INSTAGRAM_APP_SECRET;

    const redirectUri =
      process.env
        .INSTAGRAM_REDIRECT_URI;

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      console.error(
        "INSTAGRAM_OAUTH_CONFIG_MISSING",
        {
          hasClientId:
            Boolean(
              clientId,
            ),
          hasClientSecret:
            Boolean(
              clientSecret,
            ),
          hasRedirectUri:
            Boolean(
              redirectUri,
            ),
        },
      );

      return redirectToApp(
        "error",
        "configuration",
      );
    }

    const apiVersion =
      getInstagramApiVersion();

    const creator =
      await db.orm.public.Creator
        .where({
          id:
            creatorId,
        })
        .first();

    if (!creator) {
      console.error(
        "INSTAGRAM_CREATOR_NOT_FOUND",
      );

      return redirectToApp(
        "error",
        "creator_not_found",
      );
    }

    const tokenBody =
      new FormData();

    tokenBody.set(
      "client_id",
      clientId,
    );

    tokenBody.set(
      "client_secret",
      clientSecret,
    );

    tokenBody.set(
      "grant_type",
      "authorization_code",
    );

    tokenBody.set(
      "redirect_uri",
      redirectUri,
    );

    tokenBody.set(
      "code",
      code,
    );

    console.log(
      "INSTAGRAM_TOKEN_EXCHANGE_START",
    );

    const shortTokenResponse =
      await fetch(
        INSTAGRAM_TOKEN_URL,
        {
          method:
            "POST",
          body:
            tokenBody,
          headers: {
            Accept:
              "application/json",
          },
          cache:
            "no-store",
          signal:
            AbortSignal.timeout(
              15000,
            ),
        },
      );

    if (
      !shortTokenResponse.ok
    ) {
      const errorText =
        await shortTokenResponse.text();

      console.error(
        "INSTAGRAM_TOKEN_EXCHANGE_FAILED",
        {
          status:
            shortTokenResponse.status,
          response:
            errorText,
        },
      );

      return redirectToApp(
        "error",
        "token_exchange",
      );
    }

    const shortTokenJson =
      await shortTokenResponse.json();

    const shortToken =
      parseShortTokenResponse(
        shortTokenJson,
      );

    if (!shortToken) {
      console.error(
        "INSTAGRAM_SHORT_TOKEN_INVALID",
      );

      return redirectToApp(
        "error",
        "missing_access_token",
      );
    }

    console.log(
      "INSTAGRAM_SHORT_TOKEN_OK",
      {
        hasUserId:
          Boolean(
            shortToken.user_id,
          ),
        hasPermissions:
          Boolean(
            shortToken.permissions,
          ),
      },
    );

    const longTokenUrl =
      new URL(
        `${INSTAGRAM_GRAPH_BASE_URL}/access_token`,
      );

    longTokenUrl.searchParams.set(
      "grant_type",
      "ig_exchange_token",
    );

    longTokenUrl.searchParams.set(
      "client_secret",
      clientSecret,
    );

    longTokenUrl.searchParams.set(
      "access_token",
      shortToken.access_token,
    );

    console.log(
      "INSTAGRAM_LONG_TOKEN_EXCHANGE_START",
      {
        apiVersion,
      },
    );

    const longTokenResponse =
      await fetch(
        longTokenUrl.toString(),
        {
          method:
            "GET",
          headers: {
            Accept:
              "application/json",
          },
          cache:
            "no-store",
          signal:
            AbortSignal.timeout(
              15000,
            ),
        },
      );

    if (!longTokenResponse.ok) {
      const errorText =
        await longTokenResponse.text();

      console.error(
        "INSTAGRAM_LONG_TOKEN_EXCHANGE_FAILED",
        {
          status:
            longTokenResponse.status,
          response:
            errorText,
          apiVersion,
        },
      );

      /*
       * Never persist the one-hour short-lived token as CONNECTED.
       * A connection is only accepted after Instagram returns the
       * long-lived token used for real publishing.
       */
      return redirectToApp(
        "error",
        "long_token_exchange",
      );
    }

    const longTokenJson =
      await longTokenResponse.json();

    const longToken =
      parseLongTokenResponse(
        longTokenJson,
      );

    if (!longToken) {
      console.error(
        "INSTAGRAM_LONG_TOKEN_INVALID",
      );

      return redirectToApp(
        "error",
        "invalid_long_token",
      );
    }

    const effectiveAccessToken =
      longToken.access_token;

    const effectiveExpiresIn =
      typeof longToken.expires_in ===
      "number"
        ? longToken.expires_in
        : 60 * 24 * 60 * 60;

    console.log(
      "INSTAGRAM_LONG_TOKEN_OK",
      {
        apiVersion,
        hasExpiry:
          typeof longToken.expires_in ===
          "number",
      },
    );

    const profileLookupId =
      shortToken.user_id;

    if (!profileLookupId) {
      console.error(
        "INSTAGRAM_PROFILE_LOOKUP_ID_MISSING",
      );

      return redirectToApp(
        "error",
        "missing_profile_id",
      );
    }

    let profile: InstagramProfile = {
      id: profileLookupId,
      user_id: profileLookupId,
    };

    const profileUrl =
      new URL(
        `${INSTAGRAM_GRAPH_BASE_URL}/${apiVersion}/me`,
      );

    profileUrl.searchParams.set(
      "fields",
      [
        "id",
        "user_id",
        "username",
      ].join(","),
    );

    console.log(
      "INSTAGRAM_PROFILE_CHECK_START",
      {
        apiVersion,
        usingMeEndpoint:
          true,
      },
    );

    try {
      const profileResponse =
        await fetch(
          profileUrl,
          {
            method:
              "GET",
            headers: {
              Accept:
                "application/json",
              Authorization:
                `Bearer ${effectiveAccessToken}`,
            },
            cache:
              "no-store",
            signal:
              AbortSignal.timeout(
                15000,
              ),
          },
        );

      if (profileResponse.ok) {
        const profileJson =
          await profileResponse.json();

        const parsedProfile =
          parseProfile(
            profileJson,
          );

        if (parsedProfile) {
          profile =
            parsedProfile;
        } else {
          console.warn(
            "INSTAGRAM_PROFILE_INVALID_USING_TOKEN_ID",
          );
        }
      } else {
        const errorText =
          await profileResponse.text();

        console.warn(
          "INSTAGRAM_PROFILE_UNAVAILABLE_USING_TOKEN_ID",
          {
            status:
              profileResponse.status,
            response:
              errorText,
          },
        );
      }
    } catch (profileError) {
      console.warn(
        "INSTAGRAM_PROFILE_REQUEST_ERROR_USING_TOKEN_ID",
        profileError,
      );
    }

    const externalAccountId:
      string =
        shortToken.user_id ??
        profile.id ??
        "";

    if (
      !externalAccountId
    ) {
      console.error(
        "INSTAGRAM_PROFILE_ID_MISSING",
      );

      return redirectToApp(
        "error",
        "invalid_profile",
      );
    }

    console.log(
      "INSTAGRAM_PROFILE_MAPPED",
      {
        hasId:
          Boolean(
            externalAccountId,
          ),
        username:
          profile.username ??
          null,
        accountType:
          profile.account_type ??
          null,
      },
    );

    const encryptedAccessToken =
      encryptToken(
        effectiveAccessToken,
      );

    const expiresIn =
      effectiveExpiresIn;

    const tokenExpiresAt =
      new Date(
        Date.now() +
          expiresIn *
            1000,
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
            "INSTAGRAM",
          externalAccountId:
            externalAccountId,
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
            profile.username ??
            null,
          externalDisplayName:
            existingAccount.externalDisplayName ||
            profile.username ||
            null,
          connectionType:
            "OAUTH",
          accessTokenEncrypted:
            encryptedAccessToken,
          refreshTokenEncrypted:
            null,
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
            "INSTAGRAM",
          status:
            "CONNECTED",
          externalAccountId:
            externalAccountId,
          externalUsername:
            profile.username ??
            null,
          externalDisplayName:
            profile.username ??
            null,
          connectionType:
            "OAUTH",
          accessTokenEncrypted:
            encryptedAccessToken,
          refreshTokenEncrypted:
            null,
          tokenExpiresAt,
          lastVerifiedAt:
            now,
          lastSyncAt:
            now,
        });
    }

    console.log(
      "INSTAGRAM_CONNECTED",
      {
        creatorId:
          creator.id,
        workspaceId:
          creator.workspaceId,
        externalAccountId:
          externalAccountId,
        username:
          profile.username ??
          null,
        tokenType:
          "long_lived",
      },
    );

    return redirectToApp(
      "connected",
    );
  } catch (error) {
    console.error(
      "INSTAGRAM_OAUTH_CALLBACK_ERROR",
      error,
    );

    try {
      const locale =
        normalizeLocale(
          request.cookies.get(
            OAUTH_LOCALE_COOKIE,
          )?.value,
        );

      return redirectWithStatus(
        "error",
        "internal",
        locale,
      );
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "INSTAGRAM_CALLBACK_FAILED",
        },
        {
          status: 500,
        },
      );
    }
  }
}