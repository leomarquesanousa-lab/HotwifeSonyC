import { authLocales } from "@/src/lib/auth/request";
import { hashAuthToken } from "@/src/lib/auth/tokens";
import { emailConfiguration } from "./config";
import { sendEmail } from "./client";
import { authEmailTemplate } from "./templates/auth-email";
export async function sendPasswordResetEmail({
  email,
  firstName,
  token,
  locale: requestedLocale,
}: {
  email: string;
  firstName?: string | null;
  token: string;
  locale?: string;
}) {
  const locale =
    authLocales.find((item) => item === requestedLocale) ?? "en-US";
  const url = new URL(`/${locale}/reset-password`, emailConfiguration().appUrl);
  url.searchParams.set("token", token);
  const template = await authEmailTemplate(
    "reset",
    locale,
    firstName,
    url.toString(),
  );
  return sendEmail(
    { to: email, ...template },
    "auth-reset:" + hashAuthToken(token),
  );
}
