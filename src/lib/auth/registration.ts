import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/prisma/db";
import { hashPassword } from "./password-hash";
import { createEmailVerificationToken } from "./email-verification";
import { sendVerificationEmail } from "@/src/lib/email/send-verification-email";
import { EmailError } from "@/src/lib/email/config";
import { authAudit, lockAuthKey } from "./audit";
import { hashAuthToken } from "./tokens";
import { checkAuthRateLimit } from "./rate-limit";
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
  accountType: z.enum(["CREATOR", "AGENCY"]),
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
    const { user, verification } = await db.transaction(async (tx) => {
      await lockAuthKey(tx, "auth-register:" + hashAuthToken(input.email));
      if (await tx.orm.public.User.where({ email: input.email }).first())
        throw new AuthError("EMAIL_ALREADY_EXISTS", 409);
      const user = await tx.orm.public.User.create({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        status: "PENDING",
        locale: input.locale,
        timezone: "UTC",
      });
      const workspace = await tx.orm.public.Workspace.create({
        name:
          input.firstName +
          " " +
          input.lastName +
          (input.accountType === "AGENCY" ? " Agency" : ""),
        type: input.accountType,
        status: "ACTIVE",
      });
      await tx.orm.public.WorkspaceMember.create({
        workspaceId: workspace.id,
        userId: user.id,
        role: "OWNER",
      });
      if (input.accountType === "CREATOR")
        await tx.orm.public.Creator.create({
          workspaceId: workspace.id,
          ownerUserId: user.id,
          displayName: input.firstName + " " + input.lastName,
          status: "ACTIVE",
        });
      const verification = await createEmailVerificationToken(user.id, tx);
      await tx.orm.public.AuditLog.create({
        userId: user.id,
        action: "ACCOUNT_CREATED",
        entityType: "USER",
        entityId: user.id,
        metadata: { accountType: input.accountType, locale: input.locale },
      });
      return { user, verification };
    });
    await authAudit("AUTH_REGISTER_SUCCESS", user.id);
    try {
      const result = await sendVerificationEmail({
        email: user.email,
        firstName: user.firstName,
        token: verification.token,
        locale: user.locale,
      });
      await authAudit("AUTH_VERIFICATION_EMAIL_ACCEPTED", user.id, {
        provider: "RESEND",
        providerMessageId: result.id,
        expiresAt: verification.expiresAt,
      });
    } catch (error) {
      await authAudit("AUTH_VERIFICATION_EMAIL_FAILED", user.id, {
        code: error instanceof EmailError ? error.code : "EMAIL_SEND_FAILED",
      });
      return NextResponse.json(
        {
          success: false,
          accountCreated: true,
          verificationRequired: true,
          error: "VERIFICATION_EMAIL_FAILED",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        success: true,
        verificationRequired: true,
        user: { id: user.id, email: user.email, status: user.status },
      },
      { status: 201 },
    );
  } catch (error) {
    return authFailure(error);
  }
}
