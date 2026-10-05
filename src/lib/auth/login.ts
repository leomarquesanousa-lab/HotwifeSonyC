import { hashPassword } from "./password-hash";
import {
  createSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "./session";
import { getRequestIp, checkAuthRateLimit } from "./rate-limit";
import { parseAuthBody, authFailure } from "./request";

import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyPassword } from "./password-hash";
import { db } from "@/src/prisma/db";

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

    if (user.status === "PENDING") {
      await db.orm.public.LoginAttempt.create({
        email,
        ipAddress,
        userAgent,
        successful: false,
      });

      await db.orm.public.AuditLog.create({
        userId: user.id,
        action: "LOGIN_BLOCKED",
        entityType: "USER",
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: {
          reason: "EMAIL_NOT_VERIFIED",
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email before signing in.",
        },
        {
          status: 403,
        },
      );
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
    }).first();

    if (!membership) {
      await db.orm.public.AuditLog.create({
        userId: user.id,
        action: "LOGIN_BLOCKED",
        entityType: "USER",
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: {
          reason: "WORKSPACE_MEMBERSHIP_NOT_FOUND",
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: "WORKSPACE_NOT_FOUND",
          message: "No workspace is associated with this account.",
        },
        {
          status: 403,
        },
      );
    }

    let workspace = await db.orm.public.Workspace.where({
      id: membership.workspaceId,
    }).first();

    if (!workspace) {
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

    if (workspace.status !== "ACTIVE") {
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

    /*
     * Backward compatibility:
     *
     * Accounts created before the final onboarding
     * step existed may already have a real Creator
     * and connected platforms while
     * onboardingCompletedAt is still null.
     *
     * In that case, mark the workspace as complete
     * automatically instead of forcing the user
     * through onboarding again.
     */

    if (!workspace.onboardingCompletedAt) {
      const [existingCreator, connectedPlatform] = await Promise.all([
        db.orm.public.Creator.where({
          workspaceId: workspace.id,
          status: "ACTIVE",
        }).first(),

        db.orm.public.PlatformAccount.where({
          workspaceId: workspace.id,
          status: "CONNECTED",
        }).first(),
      ]);

      if (existingCreator && connectedPlatform) {
        const completedAt = new Date().toISOString();

        await db.orm.public.Workspace.where({
          id: workspace.id,
        }).update({
          onboardingStatus: "COMPLETE",
          onboardingCompletedAt: completedAt,
        });

        workspace = await db.orm.public.Workspace.where({
          id: workspace.id,
        }).first();

        if (!workspace) {
          return NextResponse.json(
            {
              success: false,
              error: "WORKSPACE_NOT_FOUND",
              message: "Unable to reload your workspace.",
            },
            {
              status: 500,
            },
          );
        }
      }
    }

    const destination = workspace.onboardingCompletedAt ? "APP" : "ONBOARDING";

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
        workspaceId: workspace.id,
        destination,
        onboardingStatus: workspace.onboardingStatus,
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

        workspace: {
          id: workspace.id,
          name: workspace.name,
          type: workspace.type,
          status: workspace.status,
          onboardingStatus: workspace.onboardingStatus,
          onboardingCompleted: Boolean(workspace.onboardingCompletedAt),
        },
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
