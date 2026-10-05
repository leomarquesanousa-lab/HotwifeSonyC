import { NextResponse } from "next/server";

import { getCurrentSession } from "@/src/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANYVIDS_AUTH_URL = "https://api.manyvids.com/auth/token/v1";

function getCookieNameFromSetCookie(value: string) {
  const firstPart = value.split(";", 1)[0] ?? "";
  const separatorIndex = firstPart.indexOf("=");

  if (separatorIndex <= 0) {
    return null;
  }

  return firstPart.slice(0, separatorIndex).trim();
}

function getSetCookieInfo(headers: Headers) {
  const extendedHeaders = headers as Headers & {
    getSetCookie?: () => string[];
  };

  const setCookieValues =
    typeof extendedHeaders.getSetCookie === "function"
      ? extendedHeaders.getSetCookie()
      : headers.get("set-cookie")
        ? [headers.get("set-cookie") as string]
        : [];

  const cookieNames = setCookieValues
    .map(getCookieNameFromSetCookie)
    .filter((value): value is string => Boolean(value));

  return {
    hasMvAccessToken: cookieNames.includes("mv.access-token"),
    cookieNames,
  };
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
        },
        { status: 401 },
      );
    }

    const manyVidsCookieHeader =
      process.env.MANYVIDS_COOKIE_HEADER?.trim();

    if (!manyVidsCookieHeader) {
      return NextResponse.json(
        {
          success: false,
          error: "MANYVIDS_CONFIGURATION_MISSING",
          missing: {
            MANYVIDS_COOKIE_HEADER: true,
          },
        },
        { status: 500 },
      );
    }

    const upstream = await fetch(MANYVIDS_AUTH_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: manyVidsCookieHeader,
        Origin: "https://www.manyvids.com",
        Referer: "https://www.manyvids.com/",
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
    });

    const responseText = await upstream.text();

    let responseBody: unknown = responseText;

    try {
      responseBody = JSON.parse(responseText);
    } catch {
      // Keep plain text when the upstream response is not JSON.
    }

    const setCookieInfo = getSetCookieInfo(upstream.headers);

    if (!upstream.ok) {
      return NextResponse.json(
        {
          success: false,
          stage: "AUTH_TOKEN_REFRESH",
          error: "MANYVIDS_AUTH_TOKEN_REFRESH_FAILED",
          upstreamStatus: upstream.status,
          setCookieDetected: setCookieInfo.hasMvAccessToken,
          setCookieNames: setCookieInfo.cookieNames,
          upstreamResponse: responseBody,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      stage: "AUTH_TOKEN_REFRESH",
      upstreamStatus: upstream.status,
      setCookieDetected: setCookieInfo.hasMvAccessToken,
      setCookieNames: setCookieInfo.cookieNames,
      responseReceived: responseBody !== null,
    });
  } catch (error) {
    console.error("ManyVids auth token refresh test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "MANYVIDS_AUTH_TOKEN_REFRESH_TEST_FAILED",
      },
      { status: 500 },
    );
  }
}
