import { db } from "@/src/prisma/db";
export type AuthTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];
export async function authAudit(
  action: string,
  userId?: string,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  console.info(action);
  try {
    await db.orm.public.AuditLog.create({
      action,
      userId: userId ?? null,
      entityType: "USER",
      entityId: userId ?? null,
      metadata,
    });
  } catch {
    console.error("AUTH_AUDIT_WRITE_FAILED", { event: action });
  }
}
export async function lockAuthKey(tx: AuthTransaction, key: string) {
  const plan = db.raw
    .sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`
    .returnsRow({ locked: "pg/int4@1" })
    .build();
  await tx.execute(plan);
}
