import { createHash, randomBytes } from "node:crypto";
export function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function newAuthToken(durationMs: number) {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashAuthToken(token),
    expiresAt: new Date(Date.now() + durationMs).toISOString(),
  };
}
export function usableToken(
  token: { usedAt: string | null; expiresAt: string } | null,
  now = Date.now(),
) {
  return Boolean(
    token &&
    !token.usedAt &&
    Number.isFinite(Date.parse(token.expiresAt)) &&
    Date.parse(token.expiresAt) > now,
  );
}
