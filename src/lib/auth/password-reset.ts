import { db } from "@/src/prisma/db";
import { newAuthToken, hashAuthToken } from "./tokens";
import type { AuthTransaction } from "./audit";
export async function createPasswordResetToken(
  userId: string,
  client: Pick<AuthTransaction, "orm"> = db,
) {
  const value = newAuthToken(3600000);
  await client.orm.public.PasswordResetToken.create({
    userId,
    tokenHash: value.tokenHash,
    expiresAt: value.expiresAt,
  });
  return { token: value.token, expiresAt: value.expiresAt };
}
export const getPasswordResetTokenHash = hashAuthToken;
