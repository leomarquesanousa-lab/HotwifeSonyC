import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/prisma/db";
import { hashPassword } from "./password-hash";
import { authAudit, lockAuthKey } from "./audit";
import { hashAuthToken } from "./tokens";
import { checkAuthRateLimit, getRequestIp } from "./rate-limit";
import { createSession, SESSION_COOKIE_NAME, sessionCookieOptions } from "./session";
import {
  AuthError,
  authFailure,
  parseAuthBody,
  emailSchema,
  localeSchema,
  passwordSchema,
} from "./request";
const schema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().max(128),
  acceptedTerms: z.literal(true),
  locale: localeSchema,
});
export async function register(request: Request) {
  try {
    const input = await parseAuthBody(request, schema);
    if (input.password !== input.confirmPassword)
      throw new AuthError("PASSWORD_MISMATCH");
    await checkAuthRateLimit("register", request, input.email);
    const passwordHash = await hashPassword(input.password);
    const user = await db.transaction(async (tx) => {
      await lockAuthKey(tx, "auth-register:" + hashAuthToken(input.email));
      if (await tx.orm.public.User.where({ email: input.email }).first())
        throw new AuthError("EMAIL_ALREADY_EXISTS", 409);
      const user = await tx.orm.public.User.create({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        status: "ACTIVE",
        locale: input.locale,
        timezone: "UTC",
      });
      await tx.orm.public.AuditLog.create({
        userId: user.id,
        action: "ACCOUNT_CREATED",
        entityType: "USER",
        entityId: user.id,
        metadata: { locale: input.locale },
      });
      return user;
    });
    await authAudit("AUTH_REGISTER_SUCCESS", user.id);
    const { sessionToken } = await createSession(user.id, user.passwordHash, {
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
      clientType: 'WEB',
    });
    const response = NextResponse.json({
      success: true, destination: 'ACCOUNT',
      user: { id: user.id, email: user.email, status: user.status },
    }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
    return response;
  } catch (error) {
    return authFailure(error);
  }
}
