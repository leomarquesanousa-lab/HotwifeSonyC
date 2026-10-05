import { hashPassword } from "./password-hash";
import {
  createSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "./session";
import { getRequestIp, checkAuthRateLimit } from "./rate-limit";
import { AuthError, parseAuthBody, authFailure } from "./request";

import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyPassword } from "./password-hash";
import { db } from "@/src/prisma/db";
import { ADMIN_ROLES } from './admin-access';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),

  password: z.string().min(1).max(128),

  clientType: z.enum(["WEB", "MOBILE"]).default("WEB"),
});

export async function login(request: Request) {
  try {
    const input = await parseAuthBody(request, loginSchema);
    await checkAuthRateLimit("login", request, input.email);
    const ipAddress = getRequestIp(request);

    const userAgent = request.headers.get("user-agent");

    const { email, password, clientType } = input;

    const user = await db.orm.public.User.where({
      email,
    }).first();

    if (!user) {
      await hashPassword(password); // Match the expensive password path for unknown accounts.
      await db.orm.public.LoginAttempt.create({
        email,
        ipAddress,
        userAgent,
        successful: false,
      });

      return NextResponse.json(
        {
          success: false,
          error: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
        {
          status: 401,
        },
      );
    }

    const passwordIsValid = await verifyPassword(user.passwordHash, password);

    if (!passwordIsValid) {
      await db.orm.public.LoginAttempt.create({
        email,
        ipAddress,
        userAgent,
        successful: false,
      });

      await db.orm.public.AuditLog.create({
        userId: user.id,
        action: "LOGIN_FAILED",
        entityType: "USER",
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: {
          reason: "INVALID_PASSWORD",
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
        {
          status: 401,
        },
      );
    }

    // Legacy pending accounts may sign in with their existing valid password.
    if (user.status === "PENDING") {
      const activated = await db.orm.public.User.where({
        id: user.id, status: 'PENDING', passwordHash: user.passwordHash,
      }).updateAndCount({ status: 'ACTIVE' });
      if (activated !== 1) throw new AuthError('ACCOUNT_UNAVAILABLE', 403);
      user.status = 'ACTIVE';
    }

    if (user.status !== "ACTIVE") {
      await db.orm.public.LoginAttempt.create({
        email,
        ipAddress,
        userAgent,
        successful: false,
      });

      return NextResponse.json(
        {
          success: false,
          error: "ACCOUNT_UNAVAILABLE",
          message: "This account is currently unavailable.",
        },
        {
          status: 403,
        },
      );
    }

    const membership = await db.orm.public.WorkspaceMember.where({
      userId: user.id,
    }).where(member => member.role.in([...ADMIN_ROLES])).first();

    const workspace = membership ? await db.orm.public.Workspace.where({
      id: membership.workspaceId,
    }).first() : null;

    if (membership && !workspace) {
      await db.orm.public.AuditLog.create({
        userId: user.id,
        action: "LOGIN_BLOCKED",
        entityType: "WORKSPACE",
        entityId: membership.workspaceId,
        ipAddress,
        userAgent,
        metadata: {
          reason: "WORKSPACE_NOT_FOUND",
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: "WORKSPACE_NOT_FOUND",
          message: "Unable to load your workspace.",
        },
        {
          status: 403,
        },
      );
    }

    if (workspace && workspace.status !== "ACTIVE") {
      await db.orm.public.AuditLog.create({
        userId: user.id,
        action: "LOGIN_BLOCKED",
        entityType: "WORKSPACE",
        entityId: workspace.id,
        ipAddress,
        userAgent,
        metadata: {
          reason: "WORKSPACE_INACTIVE",
          workspaceStatus: workspace.status,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: "WORKSPACE_UNAVAILABLE",
          message: "This workspace is currently unavailable.",
        },
        {
          status: 403,
        },
      );
    }

    const destination = workspace ? "APP" : "ACCOUNT";

    const { session, sessionToken } = await createSession(
      user.id,
      user.passwordHash,
      { ipAddress, userAgent: userAgent?.slice(0, 500) ?? null, clientType },
    );

    await db.orm.public.LoginAttempt.create({
      email,
      ipAddress,
      userAgent,
      successful: true,
    });

    await db.orm.public.AuditLog.create({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      entityType: "SESSION",
      entityId: session.id,
      ipAddress,
      userAgent,
      metadata: {
        clientType,
        workspaceId: workspace?.id ?? null,
        destination,
        onboardingStatus: workspace?.onboardingStatus ?? null,
      },
    });

    const response = NextResponse.json(
      {
        success: true,

        destination,

        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          locale: user.locale,
        },

        workspace: workspace ? {
          id: workspace.id,
          name: workspace.name,
          type: workspace.type,
          status: workspace.status,
          onboardingStatus: workspace.onboardingStatus,
          onboardingCompleted: Boolean(workspace.onboardingCompletedAt),
        } : null,
      },
      {
        status: 200,
      },
    );

    response.cookies.set(
      SESSION_COOKIE_NAME,
      sessionToken,
      sessionCookieOptions(),
    );

    return response;
  } catch (error) {
    return authFailure(error);
  }
}
