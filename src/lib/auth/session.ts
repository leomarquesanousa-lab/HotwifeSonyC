import { NextResponse } from "next/server";
import { newAuthToken, hashAuthToken } from "./tokens";
import { lockAuthKey } from "./audit";
import { AuthError, authFailure, parseAuthBody } from "./request";
import { z } from "zod";
import { cookies } from "next/headers";

import { db } from "../../prisma/db";

export const SESSION_COOKIE_NAME = "creator_session";

export const hashSessionToken = hashAuthToken;
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

export async function getCurrentSession() {
  const cookieStore = await cookies();

  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  return getSessionFromToken(sessionToken);
}

export async function getSessionFromToken(sessionToken: string | undefined) {

  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);

  const session = await db.orm.public.Session.where({
    tokenHash,
  }).first();

  if (!session) {
    return null;
  }

  if (session.status !== "ACTIVE" || session.revokedAt) {
    return null;
  }

  const expiresAt = new Date(session.expiresAt).getTime();

  if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  const user = await db.orm.public.User.where({
    id: session.userId,
  }).first();

  if (!user) {
    return null;
  }

  if (user.status !== "ACTIVE") {
    return null;
  }

  return {
    session,
    user,
  };
}

export async function requireSession() {
  const auth = await getCurrentSession();

  if (!auth) {
    return null;
  }

  return auth;
}
export const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
});
export async function createSession(
  userId: string,
  passwordHash: string,
  details: {
    ipAddress: string | null;
    userAgent: string | null;
    clientType: "WEB" | "MOBILE";
  },
) {
  const value = newAuthToken(SESSION_DURATION_SECONDS * 1000);
  const session = await db.transaction(async (tx) => {
    await lockAuthKey(tx, "auth-user:" + userId);
    const user = await tx.orm.public.User.where({
      id: userId,
      status: "ACTIVE",
      passwordHash,
    }).first();
    if (!user) throw new AuthError("INVALID_CREDENTIALS", 401);
    return tx.orm.public.Session.create({
      userId,
      tokenHash: value.tokenHash,
      status: "ACTIVE",
      expiresAt: value.expiresAt,
      ...details,
    });
  });
  return { session, sessionToken: value.token };
}
export async function logout(request: Request) {
  try {
    await parseAuthBody(request, z.object({}));
    const store = await cookies();
    const token = store.get(SESSION_COOKIE_NAME)?.value;
    if (token)
      await db.transaction(async (tx) => {
        const session = await tx.orm.public.Session.where({
          tokenHash: hashAuthToken(token),
        }).first();
        if (!session) return;
        await lockAuthKey(tx, "auth-user:" + session.userId);
        await tx.orm.public.Session.where({
          id: session.id,
          status: "ACTIVE",
        }).updateAndCount({
          status: "REVOKED",
          revokedAt: new Date().toISOString(),
        });
        await tx.orm.public.AuditLog.create({
          action: "AUTH_LOGOUT",
          userId: session.userId,
          entityType: "SESSION",
          entityId: session.id,
        });
      });
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
