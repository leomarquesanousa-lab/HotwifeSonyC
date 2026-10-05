import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/prisma/db";
import { hashPassword, verifyPassword } from "./password-hash";
import { hashAuthToken, usableToken } from "./tokens";
import { authAudit, lockAuthKey } from "./audit";
import { checkAuthRateLimit } from "./rate-limit";
import {
  getCurrentSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "./session";
import {
  AuthError,
  authFailure,
  parseAuthBody,
  passwordSchema,
  tokenSchema,
} from "./request";
const passwordFields = {
  password: passwordSchema,
  confirmPassword: z.string().max(128),
};
export async function resetPassword(request: Request) {
  try {
    const input = await parseAuthBody(
      request,
      z.object({ token: tokenSchema, ...passwordFields }),
    );
    if (input.password !== input.confirmPassword)
      throw new AuthError("PASSWORD_MISMATCH");
    await checkAuthRateLimit("reset", request, input.token);
    const tokenHash = hashAuthToken(input.token);
    const found = await db.orm.public.PasswordResetToken.where({
      tokenHash,
    }).first();
    if (!usableToken(found) || !found) throw new AuthError("INVALID_TOKEN");
    const passwordHash = await hashPassword(input.password);
    await db.transaction(async (tx) => {
      await lockAuthKey(tx, "auth-user:" + found.userId);
      const token = await tx.orm.public.PasswordResetToken.where({
        tokenHash,
      }).first();
      if (!usableToken(token)) throw new AuthError("INVALID_TOKEN");
      const user = await tx.orm.public.User.where({ id: found.userId }).first();
      if (!user || !["ACTIVE", "PENDING"].includes(user.status))
        throw new AuthError("INVALID_TOKEN");
      const now = new Date().toISOString();
      if (
        (await tx.orm.public.PasswordResetToken.where({
          id: found.id,
          usedAt: null,
        })
          .where((row) => row.expiresAt.gt(now))
          .updateAndCount({ usedAt: now })) !== 1
      )
        throw new AuthError("INVALID_TOKEN");
      if (
        (await tx.orm.public.User.where({
          id: user.id,
          status: user.status,
        }).updateAndCount({ passwordHash })) !== 1
      )
        throw new AuthError("INVALID_TOKEN");
      await tx.orm.public.PasswordResetToken.where({
        userId: user.id,
        usedAt: null,
      }).updateAndCount({ usedAt: now });
      await tx.orm.public.Session.where({
        userId: user.id,
        status: "ACTIVE",
      }).updateAndCount({ status: "REVOKED", revokedAt: now });
      await tx.orm.public.AuditLog.create({
        action: "PASSWORD_RESET_COMPLETED",
        userId: user.id,
        entityType: "USER",
        entityId: user.id,
      });
    });
    await authAudit("AUTH_PASSWORD_RESET_COMPLETED", found.userId);
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      ...sessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return authFailure(error);
  }
}
export async function changePassword(request: Request) {
  try {
    const input = await parseAuthBody(
      request,
      z.object({
        currentPassword: z.string().min(1).max(128),
        ...passwordFields,
      }),
    );
    const auth = await getCurrentSession();
    if (!auth) throw new AuthError("UNAUTHORIZED", 401);
    await checkAuthRateLimit("change", request, auth.user.id);
    if (input.password !== input.confirmPassword)
      throw new AuthError("PASSWORD_MISMATCH");
    if (!(await verifyPassword(auth.user.passwordHash, input.currentPassword)))
      throw new AuthError("INVALID_CREDENTIALS", 401);
    const passwordHash = await hashPassword(input.password);
    await db.transaction(async (tx) => {
      await lockAuthKey(tx, "auth-user:" + auth.user.id);
      const session = await tx.orm.public.Session.where({
        id: auth.session.id,
        status: "ACTIVE",
        revokedAt: null,
      }).first();
      if (!session || Date.parse(session.expiresAt) <= Date.now())
        throw new AuthError("UNAUTHORIZED", 401);
      if (
        (await tx.orm.public.User.where({
          id: auth.user.id,
          status: "ACTIVE",
          passwordHash: auth.user.passwordHash,
        }).updateAndCount({ passwordHash })) !== 1
      )
        throw new AuthError("INVALID_CREDENTIALS", 401);
      const now = new Date().toISOString();
      await tx.orm.public.PasswordResetToken.where({
        userId: auth.user.id,
        usedAt: null,
      }).updateAndCount({ usedAt: now });
      await tx.orm.public.Session.where({
        userId: auth.user.id,
        status: "ACTIVE",
      })
        .where((row) => row.id.neq(auth.session.id))
        .updateAndCount({ status: "REVOKED", revokedAt: now });
      await tx.orm.public.AuditLog.create({
        action: "AUTH_PASSWORD_CHANGED",
        userId: auth.user.id,
        entityType: "USER",
        entityId: auth.user.id,
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return authFailure(error);
  }
}
