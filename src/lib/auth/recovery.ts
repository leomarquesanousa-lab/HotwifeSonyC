import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/prisma/db";
import { createEmailVerificationToken } from "./email-verification";
import { createPasswordResetToken } from "./password-reset";
import { sendVerificationEmail } from "@/src/lib/email/send-verification-email";
import { sendPasswordResetEmail } from "@/src/lib/email/send-password-reset-email";
import { EmailError } from "@/src/lib/email/config";
import { authAudit, lockAuthKey } from "./audit";
import { checkAuthRateLimit } from "./rate-limit";
import {
  authFailure,
  emailSchema,
  localeSchema,
  parseAuthBody,
} from "./request";
const schema = z.object({ email: emailSchema, locale: localeSchema });
export async function requestRecovery(
  request: Request,
  kind: "resend" | "forgot",
) {
  const started = Date.now();
  try {
    const input = await parseAuthBody(request, schema);
    await checkAuthRateLimit(kind, request, input.email);
    await authAudit(
      kind === "resend"
        ? "AUTH_RESEND_REQUESTED"
        : "AUTH_PASSWORD_RESET_REQUESTED",
    );
    const user = await db.orm.public.User.where({ email: input.email }).first();
    if (
      user &&
      (kind === "resend"
        ? user.status === "PENDING" && !user.emailVerifiedAt
        : ["ACTIVE", "PENDING"].includes(user.status))
    ) {
      try {
        const issued = await db.transaction(async (tx) => {
          await lockAuthKey(tx, "auth-user:" + user.id);
          const current = await tx.orm.public.User.where({
            id: user.id,
          }).first();
          if (
            !current ||
            (kind === "resend"
              ? current.status !== "PENDING" || Boolean(current.emailVerifiedAt)
              : !["ACTIVE", "PENDING"].includes(current.status))
          )
            return null;
          return kind === "resend"
            ? createEmailVerificationToken(user.id, tx)
            : createPasswordResetToken(user.id, tx);
        });
        if (issued) {
          const send =
            kind === "resend" ? sendVerificationEmail : sendPasswordResetEmail;
          const result = await send({
            email: user.email,
            firstName: user.firstName,
            token: issued.token,
            locale: user.locale || input.locale,
          });
          await authAudit(
            kind === "resend"
              ? "AUTH_VERIFICATION_EMAIL_ACCEPTED"
              : "AUTH_PASSWORD_RESET_EMAIL_ACCEPTED",
            user.id,
            {
              provider: "RESEND",
              providerMessageId: result.id,
              expiresAt: issued.expiresAt,
            },
          );
        }
      } catch (error) {
        await authAudit(
          kind === "resend"
            ? "AUTH_VERIFICATION_EMAIL_FAILED"
            : "AUTH_PASSWORD_RESET_EMAIL_FAILED",
          user.id,
          {
            code:
              error instanceof EmailError ? error.code : "EMAIL_REQUEST_FAILED",
          },
        );
      }
    }
    // Same status/body for absent, active, pending, disabled and provider-failure cases.
    // Padding reduces the simplest timing distinction; provider latency is not constant-time.
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.max(0, 900 + randomInt(200) - (Date.now() - started)),
      ),
    );
    return NextResponse.json(
      { success: true, messageCode: "RECOVERY_REQUEST_ACCEPTED" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return authFailure(error);
  }
}
