import { NextResponse } from "next/server";
import { getCurrentSession } from "@/src/lib/auth/session";
import { db } from "@/src/prisma/db";
import { executeManyVidsPublication } from "@/src/lib/distribution/execute-manyvids";
import { publishInputSchema } from "@/src/lib/platforms/manyvids/http/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  const parsed = publishInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { success: false, error: "INVALID_INPUT" },
      { status: 400 },
    );
  const publication = await db.orm.public.PlatformPublication.where({
    id: parsed.data.publicationId,
  }).first();
  const member =
    publication &&
    (await db.orm.public.WorkspaceMember.where({
      userId: session.user.id,
      workspaceId: publication.workspaceId,
    }).first());
  if (!member)
    return NextResponse.json(
      { success: false, error: "PUBLICATION_NOT_FOUND" },
      { status: 404 },
    );
  return executeManyVidsPublication(parsed.data);
}
