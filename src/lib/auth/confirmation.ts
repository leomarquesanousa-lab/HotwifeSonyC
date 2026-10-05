import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/prisma/db";
import { hashAuthToken, usableToken } from "./tokens";
import { authAudit, lockAuthKey } from "./audit";
import { checkAuthRateLimit } from "./rate-limit";
import { AuthError, authFailure, parseAuthBody, tokenSchema } from "./request";
export async function verifyEmail(request: Request) {
  try {
    const { token } = await parseAuthBody(
      request,
      z.object({ token: tokenSchema }),
    );
    await checkAuthRateLimit("verify", request, token);
    const tokenHash = hashAuthToken(token);
    const found = await db.orm.public.EmailVerificationToken.where({
      tokenHash,
    }).first();
    if (!found) throw new AuthError("INVALID_TOKEN");
    await db.transaction(async (tx) => {
      await lockAuthKey(tx, "auth-user:" + found.userId);
      const current = await tx.orm.public.EmailVerificationToken.where({
        tokenHash,
      }).first();
      if (!usableToken(current)) throw new AuthError("INVALID_TOKEN");
      const user = await tx.orm.public.User.where({ id: found.userId }).first();
      if (!user || !["PENDING", "ACTIVE"].includes(user.status))
        throw new AuthError("INVALID_TOKEN");
      const now = new Date().toISOString();
      const count = await tx.orm.public.EmailVerificationToken.where({
        id: found.id,
        usedAt: null,
      })
        .where((row) => row.expiresAt.gt(now))
        .updateAndCount({ usedAt: now });
      if (count !== 1) throw new AuthError("INVALID_TOKEN");
      if (
        (await tx.orm.public.User.where({
          id: user.id,
          status: user.status,
        }).updateAndCount({ status: "ACTIVE", emailVerifiedAt: now })) !== 1
      )
        throw new AuthError("INVALID_TOKEN");
      await tx.orm.public.EmailVerificationToken.where({
        userId: user.id,
        usedAt: null,
      }).updateAndCount({ usedAt: now });
      await tx.orm.public.AuditLog.create({
        action: "EMAIL_VERIFIED",
        userId: user.id,
        entityType: "USER",
        entityId: user.id,
      });
    });
    await authAudit("AUTH_EMAIL_VERIFIED", found.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authFailure(error);
  }
}
