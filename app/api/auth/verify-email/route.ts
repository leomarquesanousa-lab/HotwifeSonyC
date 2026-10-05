import { NextResponse } from "next/server";
export function POST() {
  return NextResponse.json({ success: false, error: "ENDPOINT_RETIRED" }, { status: 410 });
}
