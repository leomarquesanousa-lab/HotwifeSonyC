import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@/src/prisma/db";
import { hashAuthToken } from "./tokens";
import { lockAuthKey } from "./audit";
import { AuthError } from "./request";
const trustedIp = new AsyncLocalStorage<string | null>();
export function withAuthRequestIp<T>(
  ip: string | null,
  callback: () => Promise<T>,
) {
  return trustedIp.run(ip, callback);
}
export function getRequestIp(request: Request) {
  // Cloudflare supplies this through worker/index.ts. Do not trust client-provided forwarded headers by default.
  return (
    trustedIp.getStore() ??
    (process.env.AUTH_TRUST_PROXY === "true"
      ? (request.headers
          .get("x-forwarded-for")
          ?.split(",")[0]
          ?.trim()
          .slice(0, 64) ?? null)
      : null)
  );
}
const limits = {
  login: [10, 60, 15],
  register: [3, 10, 60],
  resend: [3, 20, 60],
  forgot: [3, 20, 60],
  verify: [10, 60, 15],
  reset: [5, 30, 15],
  change: [5, 20, 15],
} as const;
export async function checkAuthRateLimit(
  action: keyof typeof limits,
  request: Request,
  subject: string,
) {
  const [perSubject, perIp, minutes] = limits[action];
  const now = new Date();
  const cutoff = new Date(now.getTime() - minutes * 60_000).toISOString();
  const buckets = [
    { key: hashAuthToken(action + ":subject:" + subject), limit: perSubject },
    {
      key: hashAuthToken(
        action + ":ip:" + (getRequestIp(request) ?? "unavailable"),
      ),
      limit: perIp,
    },
  ].sort((a, b) => a.key.localeCompare(b.key));
  await db.transaction(async (tx) => {
    for (const bucket of buckets)
      await lockAuthKey(tx, "auth-rate:" + bucket.key);
    for (const bucket of buckets) {
      const count = await tx.orm.public.AuditLog.where({
        entityType: "AUTH_RATE_LIMIT",
        entityId: bucket.key,
      })
        .where((row) => row.createdAt.gte(cutoff))
        .select("id")
        .limit(bucket.limit)
        .all();
      if (count.length >= bucket.limit)
        throw new AuthError("RATE_LIMITED", 429);
    }
    for (const bucket of buckets)
      await tx.orm.public.AuditLog.create({
        action: "AUTH_RATE_" + action.toUpperCase(),
        entityType: "AUTH_RATE_LIMIT",
        entityId: bucket.key,
      });
  });
}
