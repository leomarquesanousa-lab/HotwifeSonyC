import { NextResponse } from "next/server";
import { z } from "zod";
export const authLocales = [
  "en-US",
  "pt-BR",
  "es-ES",
  "fr-FR",
  "cs-CZ",
] as const;
export const localeSchema = z.enum(authLocales).default("en-US");
export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(255)
  .transform((v) => v.toLowerCase());
export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export class AuthError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
    this.name = "AuthError";
  }
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new AuthError("INVALID_ORIGIN", 403);
  if (origin) {
    let permittedOrigins: Set<string>;
    try {
      const publicUrl = new URL(
        process.env.NODE_ENV === "production"
          ? process.env.APP_URL ?? ""
          : request.url,
      );
      if (process.env.NODE_ENV === "production" && (
        publicUrl.protocol !== "https:" || publicUrl.username || publicUrl.password ||
        publicUrl.hostname === "localhost" || publicUrl.hostname.endsWith(".localhost") ||
        publicUrl.hostname === "127.0.0.1" || publicUrl.hostname === "[::1]"
      )) throw new Error("Invalid public URL");
      permittedOrigins = new Set([publicUrl.origin]);
      if (process.env.NODE_ENV === "production") {
        // Both public hostnames serve this site. Never trust arbitrary proxy hosts.
        if (["hotwifesonyc.com", "www.hotwifesonyc.com"].includes(publicUrl.hostname)) {
          const alias = new URL(publicUrl.origin);
          alias.hostname = publicUrl.hostname === "hotwifesonyc.com" ? "www.hotwifesonyc.com" : "hotwifesonyc.com";
          permittedOrigins.add(alias.origin);
        }
        const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
        const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
        const forwardedUrl = forwardedHost && forwardedProto
          ? new URL(`${forwardedProto}://${forwardedHost}`)
          : null;
        // LiteSpeed may expose an internal HTTP request URL. Use the forwarded
        // public origin only when APP_URL already authorizes it.
        if (forwardedUrl && permittedOrigins.has(forwardedUrl.origin)) {
          publicUrl.href = forwardedUrl.origin;
        }
      }
      const suppliedOrigin = new URL(origin);
      if (suppliedOrigin.username || suppliedOrigin.password || suppliedOrigin.pathname !== "/" || suppliedOrigin.search || suppliedOrigin.hash ||
        (suppliedOrigin.origin !== publicUrl.origin && !permittedOrigins.has(suppliedOrigin.origin))) throw new Error("Origin mismatch");
    } catch {
      throw new AuthError("INVALID_ORIGIN", 403);
    }
  }
  // JSON-only mutations also prevent cross-site form submissions when Origin is absent (e.g. native clients).
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new AuthError("INVALID_DATA", 415);
}
export async function parseAuthBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  assertSameOrigin(request);
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 16_384) throw new Error();
    body = JSON.parse(text);
  } catch {
    throw new AuthError("INVALID_DATA");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new AuthError("INVALID_DATA");
  return parsed.data;
}
export function authFailure(error: unknown) {
  const safe =
    error instanceof AuthError
      ? error
      : new AuthError("INTERNAL_SERVER_ERROR", 500);
  console.error("AUTH_REQUEST_FAILED", { code: safe.code });
  return NextResponse.json(
    { success: false, error: safe.code },
    {
      status: safe.status,
      headers: {
        "Cache-Control": "no-store",
        ...(safe.status === 429 ? { "Retry-After": "900" } : {}),
      },
    },
  );
}
