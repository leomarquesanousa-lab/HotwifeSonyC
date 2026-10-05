import { AsyncLocalStorage } from "node:async_hooks";
export type EmailEnvironment = {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  APP_URL?: string;
};
const environment = new AsyncLocalStorage<EmailEnvironment>();
export function withEmailEnvironment<T>(
  env: EmailEnvironment,
  callback: () => Promise<T>,
) {
  return environment.run(env, callback);
}
export class EmailError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "EmailError";
  }
}
export function emailConfiguration(
  env: EmailEnvironment = environment.getStore() ?? {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    APP_URL: process.env.APP_URL,
  },
) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  const replyTo = env.EMAIL_REPLY_TO?.trim();
  if (!apiKey || !from || !env.APP_URL)
    throw new EmailError("EMAIL_CONFIGURATION_MISSING");
  const mailbox = /^(?:[^<>\r\n]+ <)?[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>?$/;
  if (
    !mailbox.test(from) ||
    /[\r\n]/.test(from) ||
    (replyTo && !mailbox.test(replyTo))
  )
    throw new EmailError("EMAIL_SENDER_INVALID");
  let base: URL;
  try {
    base = new URL(env.APP_URL);
  } catch {
    throw new EmailError("EMAIL_BASE_URL_INVALID");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/" ||
    !["http:", "https:"].includes(base.protocol) ||
    (process.env.NODE_ENV === "production" &&
      (local || base.protocol !== "https:"))
  )
    throw new EmailError("EMAIL_BASE_URL_INVALID");
  return {
    apiKey,
    from,
    replyTo,
    appUrl: base.origin,
    publicHttps: !local && base.protocol === "https:",
  };
}
