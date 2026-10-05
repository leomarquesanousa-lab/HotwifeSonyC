import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/src/lib/auth/session";
import { db } from "@/src/prisma/db";
import { ManyVidsClient, WEB } from "@/src/lib/platforms/manyvids/http/client";
import { decryptManyVidsSession } from "@/src/lib/platforms/manyvids/http/session";
import { ManyVidsError, record, safeError } from "@/src/lib/platforms/manyvids/http/types";

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    const accountId = request.nextUrl.searchParams.get("platformAccountId") ?? "";
    const keywords = (request.nextUrl.searchParams.get("keywords") ?? "").trim().slice(0, 100);
    if (!accountId || keywords.length < 2) throw new ManyVidsError("ACCOUNT_AND_KEYWORDS_REQUIRED", "PERFORMER", 400);
    const account = await db.orm.public.PlatformAccount.where({ id: accountId, platform: "MANYVIDS", status: "CONNECTED" }).first();
    if (!account) throw new ManyVidsError("ACCOUNT_NOT_FOUND", "SESSION", 404);
    const member = await db.orm.public.WorkspaceMember.where({ userId: session.user.id, workspaceId: account.workspaceId }).first();
    if (!member) throw new ManyVidsError("ACCOUNT_NOT_FOUND", "SESSION", 404);
    // Search must not overwrite cookies refreshed concurrently by the publisher.
    const client = new ManyVidsClient(decryptManyVidsSession(account.accessTokenEncrypted, account.externalAccountId), async () => {});
    const body = record(await client.request(WEB, `/bff/search/creators?keywords=${encodeURIComponent(keywords)}`, "PERFORMER"));
    if (!Array.isArray(body.stars)) throw new ManyVidsError("INVALID_SEARCH_RESPONSE", "PERFORMER");
    const stars = body.stars.map(record).filter((item) => /^\d+$/.test(String(item.id)) && typeof item.username === "string").map((item) => ({ id: Number(item.id), username: item.username, label: typeof item.label === "string" ? item.label : item.username }));
    return NextResponse.json({ success: true, keywords, data: { stars } });
  } catch (error) {
    const safe = safeError(error);
    return NextResponse.json({ success: false, error: safe.code, message: safe.message }, { status: safe.httpStatus });
  }
}
