import { Resend, type Response as ResendResponse } from "resend";
import { emailConfiguration, EmailError } from "./config";
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};
type ProviderResponse = {
  data: { id: string } | null;
  error: { name: string; statusCode?: number | null } | null;
};
export type EmailTransport = (
  message: EmailMessage & { from: string; replyTo?: string },
  key: string,
) => Promise<ProviderResponse>;
// The installed SDK logs raw provider error bodies in development. Keep its payload
// mapping/public API but replace the transport boundary with sanitized failures.
class SafeResend extends Resend {
  override async fetchRequest<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<ResendResponse<T>> {
    try {
      const response = await fetch(`https://api.resend.com${path}`, {
        ...options,
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
      if (!response.ok) {
        await response.body?.cancel();
        return {
          data: null,
          error: {
            name: "application_error",
            message: "EMAIL_PROVIDER_REJECTED",
            statusCode: response.status,
          },
          headers: null,
        };
      }
      return { data: (await response.json()) as T, error: null, headers: null };
    } catch {
      throw new EmailError("EMAIL_TRANSPORT_FAILED");
    }
  }
}
export function getEmailClient() {
  return new SafeResend(emailConfiguration().apiKey, {
    baseUrl: "https://api.resend.com",
  });
}
export async function sendEmail(
  message: EmailMessage,
  idempotencyKey: string,
  transport: EmailTransport = (payload, key) =>
    getEmailClient().emails.send(payload, { idempotencyKey: key }),
) {
  const config = emailConfiguration();
  for (let attempt = 0; attempt < 2; attempt++) {
    let result: ProviderResponse;
    try {
      result = await transport(
        {
          ...message,
          from: config.from,
          ...(config.replyTo ? { replyTo: config.replyTo } : {}),
        },
        idempotencyKey,
      );
    } catch {
      if (!attempt) continue;
      throw new EmailError("EMAIL_TRANSPORT_FAILED");
    }
    if (!result.error && result.data?.id) return { id: result.data.id };
    const status = result.error?.statusCode;
    if (!attempt && (status === 429 || (status && status >= 500))) continue;
    throw new EmailError(
      status === 401 || status === 403
        ? "EMAIL_AUTH_OR_DOMAIN_REJECTED"
        : "EMAIL_PROVIDER_REJECTED",
    );
  }
  throw new EmailError("EMAIL_TRANSPORT_FAILED");
}
