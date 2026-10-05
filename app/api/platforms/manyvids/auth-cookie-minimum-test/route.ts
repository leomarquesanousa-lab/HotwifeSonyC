import { NextResponse } from "next/server";

import { getCurrentSession } from "@/src/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANYVIDS_AUTH_URL = "https://api.manyvids.com/auth/token/v1";

async function runCookieTest(
  request: Request,
  label: string,
  cookieHeader: string,
) {
  const response = await fetch(MANYVIDS_AUTH_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: cookieHeader,
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

  const setCookie = response.headers.get("set-cookie") ?? "";

  return {
    label,
    status: response.status,
    ok: response.ok,
    refreshesMvAccessToken: setCookie.includes("mv.access-token="),
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

    const phpSessionId = process.env.MANYVIDS_PHPSESSID?.trim();
    const xsrfCookie = process.env.MANYVIDS_XSRF_TOKEN?.trim();
    const fullCookieHeader = process.env.MANYVIDS_COOKIE_HEADER?.trim();

    if (!phpSessionId || !xsrfCookie || !fullCookieHeader) {
      return NextResponse.json(
        {
          success: false,
          error: "MANYVIDS_CONFIGURATION_MISSING",
          missing: {
            MANYVIDS_PHPSESSID: !phpSessionId,
            MANYVIDS_XSRF_TOKEN: !xsrfCookie,
            MANYVIDS_COOKIE_HEADER: !fullCookieHeader,
          },
        },
        { status: 500 },
      );
    }

    const phpOnly = await runCookieTest(
      request,
      "PHPSESSID_ONLY",
      `PHPSESSID=${phpSessionId}`,
    );

    const phpPlusXsrf = await runCookieTest(
      request,
      "PHPSESSID_PLUS_XSRF",
      `PHPSESSID=${phpSessionId}; XSRF-TOKEN=${xsrfCookie}`,
    );

    const fullHeader = await runCookieTest(
      request,
      "FULL_COOKIE_HEADER",
      fullCookieHeader,
    );

    return NextResponse.json({
      success: true,
      stage: "AUTH_COOKIE_MINIMUM_TEST",
      tests: [phpOnly, phpPlusXsrf, fullHeader],
    });
  } catch (error) {
    console.error("ManyVids auth cookie minimum test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "MANYVIDS_AUTH_COOKIE_MINIMUM_TEST_FAILED",
      },
      { status: 500 },
    );
  }
}
