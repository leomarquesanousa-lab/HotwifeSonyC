import { z } from "zod";
import { decryptPlatformToken, encryptPlatformToken } from "../../token-crypto";
import { ManyVidsError } from "./types";

const cookieSchema = z.object({
  name: z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/),
  value: z.string().regex(/^[^\r\n;]*$/),
  domain: z.string().regex(/^(?:[a-z0-9-]+\.)*manyvids\.com$/),
  hostOnly: z.boolean(), path: z.string().startsWith("/"), expiresAt: z.number().optional(),
  secure: z.boolean().optional(), httpOnly: z.boolean().optional(),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional(),
});
const sessionSchema = z.object({ version: z.literal(1), creatorId: z.string().regex(/^\d+$/), cookies: z.array(cookieSchema).min(1) });
export type ManyVidsSessionData = z.infer<typeof sessionSchema>;

// Provision only through trusted server-side account administration. Never accept this from execute input.
export function encryptManyVidsSession(value: ManyVidsSessionData) {
  return encryptPlatformToken(JSON.stringify(sessionSchema.parse(value)));
}
export function decryptManyVidsSession(encrypted: string | null, creatorId: string | null): ManyVidsSessionData {
  if (!encrypted || !creatorId) throw new ManyVidsError("ACCOUNT_SESSION_NOT_CONFIGURED", "SESSION", 409);
  try {
    const data = sessionSchema.parse(JSON.parse(decryptPlatformToken(encrypted)));
    if (data.creatorId !== creatorId) throw new Error("identity");
    return data;
  } catch { throw new ManyVidsError("ACCOUNT_SESSION_INVALID", "SESSION", 409); }
}

export class ManyVidsCookieJar {
  constructor(private data: ManyVidsSessionData) {}
  snapshot(): ManyVidsSessionData { return structuredClone(this.data); }
  header(url: URL): string {
    return this.data.cookies.filter((c) =>
      (!c.expiresAt || c.expiresAt > Date.now()) &&
      (!c.secure || url.protocol === "https:") &&
      (url.hostname === c.domain || (!c.hostOnly && url.hostname.endsWith(`.${c.domain}`))) &&
      (url.pathname === c.path || url.pathname.startsWith(c.path.endsWith("/") ? c.path : `${c.path}/`))
    ).sort((a, b) => b.path.length - a.path.length).map((c) => `${c.name}=${c.value}`).join("; ");
  }
  absorb(headers: Headers, url: URL): boolean {
    const enhanced = headers as Headers & { getSetCookie?: () => string[] };
    const raw = enhanced.getSetCookie?.() ?? (headers.get("set-cookie")?.split(/,(?=\s*[^;,=\s]+=)/) ?? []);
    let changed = false;
    for (const line of raw) {
      const [pair, ...attributes] = line.split(";");
      const split = pair.indexOf("=");
      if (split < 1) continue;
      const attrs = new Map(attributes.map((a) => { const n = a.indexOf("="); return n < 0 ? [a.trim().toLowerCase(), ""] : [a.slice(0, n).trim().toLowerCase(), a.slice(n + 1).trim()]; }));
      const domain = attrs.get("domain")?.replace(/^\./, "").toLowerCase() ?? url.hostname;
      if (url.hostname !== domain && !url.hostname.endsWith(`.${domain}`)) continue;
      const maxAge = attrs.get("max-age");
      const expires = maxAge !== undefined ? Date.now() + Number(maxAge) * 1000 : Date.parse(attrs.get("expires") ?? "");
      const defaultPath = url.pathname.slice(0, url.pathname.lastIndexOf("/")) || "/";
      const sameSite = ["Strict", "Lax", "None"].find(value => value.toLowerCase() === attrs.get("samesite")?.toLowerCase());
      const parsed = cookieSchema.safeParse({ name: pair.slice(0, split).trim(), value: pair.slice(split + 1), domain, hostOnly: !attrs.has("domain"), path: attrs.get("path") ?? defaultPath, secure: attrs.has("secure"), httpOnly: attrs.has("httponly"), ...(sameSite ? { sameSite } : {}), ...(Number.isFinite(expires) ? { expiresAt: expires } : {}) });
      if (!parsed.success) continue;
      const cookie = parsed.data;
      this.data.cookies = this.data.cookies.filter((c) => !(c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path));
      if (!cookie.expiresAt || cookie.expiresAt > Date.now()) this.data.cookies.push(cookie);
      changed = true;
    }
    return changed;
  }
}
