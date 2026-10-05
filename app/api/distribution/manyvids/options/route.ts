import { NextResponse } from "next/server";
import { getCurrentSession } from "@/src/lib/auth/session";
import { db } from "@/src/prisma/db";
import { loadLocalOptions } from "@/src/lib/platforms/manyvids/http/local-options";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ success: false }, { status: 401 });
  const accountId = new URL(request.url).searchParams.get("platformAccountId") ?? "";
  const account = await db.orm.public.PlatformAccount.where({ id: accountId, platform: "MANYVIDS" }).first();
  if (!account?.creatorId) return NextResponse.json({ success: false }, { status: 404 });
  const member = await db.orm.public.WorkspaceMember.where({ workspaceId: account.workspaceId, userId: session.user.id }).first();
  if (!member) return NextResponse.json({ success: false }, { status: 404 });
  return NextResponse.json({ success: true, ...await loadLocalOptions(account.workspaceId, account.creatorId) }, { headers: { "Cache-Control": "private, no-store" } });
}
