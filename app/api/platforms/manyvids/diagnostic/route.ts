import { NextResponse } from "next/server";

import { getCurrentSession } from "@/src/lib/auth/session";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(
      "https://api.manyvids.com/auth/token/v1",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Origin: "https://www.manyvids.com",
          Referer: "https://www.manyvids.com/",
        },
        cache: "no-store",
        redirect: "manual",
      },
    );

    return NextResponse.json({
      success: response.ok,
      upstreamStatus: response.status,
      server: response.headers.get("server"),
      location: response.headers.get("location"),
      contentType: response.headers.get("content-type"),
      via: response.headers.get("via"),
      xCache: response.headers.get("x-cache"),
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "NETWORK_OR_TIMEOUT",
      },
      { status: 500 },
    );
  }
}