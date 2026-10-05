import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/src/lib/auth/session";

const MANYVIDS_WEB_BASE_URL = "https://www.manyvids.com";
const MANYVIDS_API_BASE_URL = "https://api.manyvids.com";

function getSetCookieValues(headers: Headers) {
  const extendedHeaders = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof extendedHeaders.getSetCookie === "function") {
    return extendedHeaders.getSetCookie();
  }

  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function getCookieFromSetCookie(
  setCookieValues: string[],
  cookieName: string,
) {
  for (const value of setCookieValues) {
    const firstPart = value.split(";", 1)[0] ?? "";
    const separatorIndex = firstPart.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const name = firstPart.slice(0, separatorIndex).trim();

    if (name !== cookieName) {
      continue;
    }

    return firstPart.slice(separatorIndex + 1);
  }

  return null;
}

function replaceCookieValue(
  cookieHeader: string,
  cookieName: string,
  cookieValue: string,
) {
  const cookies = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex <= 0) {
        return true;
      }

      return part.slice(0, separatorIndex).trim() !== cookieName;
    });

  cookies.push(`${cookieName}=${cookieValue}`);

  return cookies.join("; ");
}


function decodeXsrfToken(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function safeText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 1000);
}

async function readResponseBody(response: Response) {
  const raw = await response.text();

  if (!raw) {
    return {
      raw: "",
      data: null as unknown,
    };
  }

  try {
    return {
      raw,
      data: JSON.parse(raw) as unknown,
    };
  } catch {
    return {
      raw,
      data: raw,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();

    if (!session) {
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

    const phpSessionId = process.env.MANYVIDS_PHPSESSID?.trim();
    const xsrfCookie = process.env.MANYVIDS_XSRF_TOKEN?.trim();
    const manyVidsUserId = process.env.MANYVIDS_USER_ID?.trim();
    const manyVidsCookieHeader = process.env.MANYVIDS_COOKIE_HEADER?.trim();

    if (
      !phpSessionId ||
      !xsrfCookie ||
      !manyVidsUserId ||
      !manyVidsCookieHeader
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "MANYVIDS_TEST_CONFIGURATION_MISSING",
          missing: {
            MANYVIDS_PHPSESSID: !phpSessionId,
            MANYVIDS_XSRF_TOKEN: !xsrfCookie,
            MANYVIDS_USER_ID: !manyVidsUserId,
            MANYVIDS_COOKIE_HEADER: !manyVidsCookieHeader,
          },
        },
        {
          status: 500,
        },
      );
    }

    if (!/^\d+$/.test(manyVidsUserId)) {
      return NextResponse.json(
        {
          success: false,
          error: "MANYVIDS_USER_ID_INVALID",
        },
        {
          status: 500,
        },
      );
    }

    const xsrfHeader = decodeXsrfToken(xsrfCookie);

    // Step 1: prove that the stored ManyVids browser session is still authenticated.
    const sessionCheckUrl = new URL(
      "/bff/search/creators",
      MANYVIDS_WEB_BASE_URL,
    );

    sessionCheckUrl.searchParams.set("keywords", "tomm");

    const sessionCheckResponse = await fetch(sessionCheckUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Cookie: [
          `PHPSESSID=${phpSessionId}`,
          `XSRF-TOKEN=${xsrfCookie}`,
        ].join("; "),
        "X-XSRF-TOKEN": xsrfHeader,
        Referer: `${MANYVIDS_WEB_BASE_URL}/`,
        "User-Agent":
          request.headers.get("user-agent") ?? "Mozilla/5.0",
      },
      cache: "no-store",
      redirect: "manual",
    });

    const sessionCheckBody = await readResponseBody(sessionCheckResponse);

    if (
      sessionCheckResponse.status >= 300 &&
      sessionCheckResponse.status < 400
    ) {
      return NextResponse.json(
        {
          success: false,
          stage: "SESSION_CHECK",
          error: "MANYVIDS_SESSION_REDIRECTED",
          upstreamStatus: sessionCheckResponse.status,
          redirectedTo: sessionCheckResponse.headers.get("location"),
        },
        {
          status: 401,
        },
      );
    }

    if (!sessionCheckResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          stage: "SESSION_CHECK",
          error: "MANYVIDS_SESSION_CHECK_FAILED",
          upstreamStatus: sessionCheckResponse.status,
          upstreamResponse:
            typeof sessionCheckBody.data === "string"
              ? safeText(sessionCheckBody.data)
              : sessionCheckBody.data,
        },
        {
          status: 502,
        },
      );
    }

    // Step 2: reproduce the confirmed ManyVids uploader/create request.
    // This creates only an upload session. It does NOT upload file bytes,
    // complete the multipart upload, create a published video, or call saveVideo.php.
    // Reproduce the exact metadata shape observed in a successful browser call.
    // No file bytes are uploaded by this test.
    const testFileName = "DIREITO DE RESPOSTA NIKOLAS FERREIRA.mp4";
    const testFileSize = 12510858;
    const testFileId =
      "uppy-direito/de/resposta/nikolas/ferreira/mp4-10-10-10-10-1e-video/mp4-12510858-1788698295262";

    const uploadCreatePayload = {
      file: {
        name: testFileName,
        size: testFileSize,
        id: testFileId,
        isRemote: false,
        type: "video/mp4",
      },
      meta: {
        user_id: Number(manyVidsUserId),
      },
    };

    const authRefreshResponse = await fetch(
      `${MANYVIDS_API_BASE_URL}/auth/token/v1`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          Cookie: manyVidsCookieHeader,
          Origin: MANYVIDS_WEB_BASE_URL,
          Referer: `${MANYVIDS_WEB_BASE_URL}/`,
          "Sec-CH-UA":
            request.headers.get("sec-ch-ua") ??
            '"Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"',
          "Sec-CH-UA-Mobile":
            request.headers.get("sec-ch-ua-mobile") ?? "?0",
          "Sec-CH-UA-Platform":
            request.headers.get("sec-ch-ua-platform") ?? '"Windows"',
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-site",
          "User-Agent":
            request.headers.get("user-agent") ??
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
        },
        cache: "no-store",
      },
    );

    const authRefreshText = await authRefreshResponse.text();

    let authRefreshBody: unknown = authRefreshText;

    try {
      authRefreshBody = JSON.parse(authRefreshText);
    } catch {
      // Keep plain text when the upstream response is not JSON.
    }

    if (!authRefreshResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          stage: "AUTH_TOKEN_REFRESH",
          sessionValidated: true,
          error: "MANYVIDS_AUTH_TOKEN_REFRESH_FAILED",
          upstreamStatus: authRefreshResponse.status,
          upstreamResponse: authRefreshBody,
        },
        { status: 502 },
      );
    }

    const refreshedAccessToken = getCookieFromSetCookie(
      getSetCookieValues(authRefreshResponse.headers),
      "mv.access-token",
    );

    if (!refreshedAccessToken) {
      return NextResponse.json(
        {
          success: false,
          stage: "AUTH_TOKEN_REFRESH",
          sessionValidated: true,
          error: "MANYVIDS_ACCESS_TOKEN_NOT_RETURNED",
          upstreamStatus: authRefreshResponse.status,
        },
        { status: 502 },
      );
    }

    const refreshedCookieHeader = replaceCookieValue(
      manyVidsCookieHeader,
      "mv.access-token",
      refreshedAccessToken,
    );

    const uploadCreateResponse = await fetch(
      `${MANYVIDS_API_BASE_URL}/uploader/create`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Content-Type": "application/json",
          Origin: MANYVIDS_WEB_BASE_URL,
          Referer: `${MANYVIDS_WEB_BASE_URL}/`,
          Cookie: refreshedCookieHeader,
          Priority: "u=1, i",
          "Sec-CH-UA":
            request.headers.get("sec-ch-ua") ??
            '"Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"',
          "Sec-CH-UA-Mobile":
            request.headers.get("sec-ch-ua-mobile") ?? "?0",
          "Sec-CH-UA-Platform":
            request.headers.get("sec-ch-ua-platform") ?? '"Windows"',
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-site",
          "User-Agent":
            request.headers.get("user-agent") ??
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
        },
        body: JSON.stringify(uploadCreatePayload),
        cache: "no-store",
        redirect: "manual",
      },
    );

    const uploadCreateBody = await readResponseBody(uploadCreateResponse);

    if (
      uploadCreateResponse.status >= 300 &&
      uploadCreateResponse.status < 400
    ) {
      return NextResponse.json(
        {
          success: false,
          stage: "UPLOAD_CREATE",
          sessionValidated: true,
          error: "MANYVIDS_UPLOAD_CREATE_REDIRECTED",
          upstreamStatus: uploadCreateResponse.status,
          redirectedTo: uploadCreateResponse.headers.get("location"),
        },
        {
          status: 502,
        },
      );
    }

    if (!uploadCreateResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          stage: "UPLOAD_CREATE",
          sessionValidated: true,
          error: "MANYVIDS_UPLOAD_CREATE_FAILED",
          upstreamStatus: uploadCreateResponse.status,
          upstreamResponse:
            typeof uploadCreateBody.data === "string"
              ? safeText(uploadCreateBody.data)
              : uploadCreateBody.data,
        },
        {
          status: 502,
        },
      );
    }

    return NextResponse.json({
      success: true,
      sessionValidated: true,
      authRefreshValidated: true,
      refreshedAccessTokenCaptured: true,
      uploadCreateValidated: true,
      manyVidsUserId,
      testFile: {
        name: testFileName,
        size: testFileSize,
        type: "video/mp4",
      },
      upstreamStatus: uploadCreateResponse.status,
      data: uploadCreateBody.data,
    });
  } catch (error) {
    console.error(
      "MANYVIDS_UPLOAD_CREATE_TEST_ERROR",
      error instanceof Error ? error.message : error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}
