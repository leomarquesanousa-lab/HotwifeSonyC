import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "../../../../src/prisma/db";
import { getEmailVerificationTokenHash } from "../../../../src/lib/auth/email-verification";

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = verifyEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_TOKEN",
          message: "Invalid verification token.",
        },
        {
          status: 400,
        },
      );
    }

    const tokenHash = getEmailVerificationTokenHash(
      parsed.data.token,
    );

    const verificationToken =
      await db.orm.public.EmailVerificationToken
        .where({
          tokenHash,
        })
        .first();

    if (!verificationToken) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_TOKEN",
          message: "Invalid verification token.",
        },
        {
          status: 400,
        },
      );
    }

    if (verificationToken.usedAt) {
      return NextResponse.json(
        {
          success: false,
          error: "TOKEN_ALREADY_USED",
          message: "This verification link has already been used.",
        },
        {
          status: 400,
        },
      );
    }

    const expiresAt = new Date(
      verificationToken.expiresAt,
    ).getTime();

    if (Date.now() > expiresAt) {
      return NextResponse.json(
        {
          success: false,
          error: "TOKEN_EXPIRED",
          message: "This verification link has expired.",
        },
        {
          status: 400,
        },
      );
    }

    const now = new Date().toISOString();

    const user = await db.orm.public.User
      .where({
        id: verificationToken.userId,
      })
      .update({
        status: "ACTIVE",
        emailVerifiedAt: now,
      });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "USER_NOT_FOUND",
          message: "Unable to verify this account.",
        },
        {
          status: 404,
        },
      );
    }

    await db.orm.public.EmailVerificationToken
      .where({
        id: verificationToken.id,
      })
      .update({
        usedAt: now,
      });

    await db.orm.public.AuditLog.create({
      userId: user.id,
      action: "EMAIL_VERIFIED",
      entityType: "USER",
      entityId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (error) {
    console.error("VERIFY_EMAIL_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to verify the email.",
      },
      {
        status: 500,
      },
    );
  }
}