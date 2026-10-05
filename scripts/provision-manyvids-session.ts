/** Local/admin only. Installed Chrome, dedicated profile, manual login. No video upload. */
import { mkdir, realpath } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { BrowserContext, Cookie } from "playwright";
import type { createDatabase } from "../src/prisma/db";
import { API, WEB } from "../src/lib/platforms/manyvids/http/client";
import { decryptManyVidsSession, encryptManyVidsSession, ManyVidsCookieJar, type ManyVidsSessionData } from "../src/lib/platforms/manyvids/http/session";

const EXPECTED_CREATOR_ID = "1011541738";

class ProvisionError extends Error {}

export function convertCookies(cookies: Cookie[], now = Date.now()): ManyVidsSessionData["cookies"] {
  return cookies.flatMap((cookie) => {
    const domain = cookie.domain.replace(/^\./, "").toLowerCase();
    if (!(domain === "manyvids.com" || domain.endsWith(".manyvids.com")) || (cookie.expires > 0 && cookie.expires * 1000 <= now)) return [];
    return [{
      name: cookie.name,
      value: cookie.value,
      domain: domain as ManyVidsSessionData["cookies"][number]["domain"],
      // Chromium/Playwright represents domain cookies with a leading dot.
      hostOnly: !cookie.domain.startsWith("."),
      path: cookie.path,
      ...(cookie.secure !== undefined ? { secure: cookie.secure } : {}),
      ...(cookie.httpOnly !== undefined ? { httpOnly: cookie.httpOnly } : {}),
      ...(cookie.sameSite !== undefined ? { sameSite: cookie.sameSite } : {}),
      ...(cookie.expires > 0 ? { expiresAt: cookie.expires * 1000 } : {}),
    }];
  });
}

export function assertBrowserCookieParity(session: ManyVidsSessionData, browserCookies: Cookie[]) {
  const expected = browserCookies.map(cookie => `${cookie.name}=${cookie.value}`).sort();
  const actual = new ManyVidsCookieJar(session).header(new URL(`${API}/uploader/create`)).split("; ").filter(Boolean).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new ProvisionError("A sessão HTTP não preservou os cookies aplicáveis do navegador. Nenhum dado foi gravado.");
  }
}

export async function captureBrowserSession(context: BrowserContext): Promise<ManyVidsSessionData> {
  // Initialize the existing login in its own context. Never select a file or call uploader/create.
  const page = await context.newPage();
  const response = await page.goto(`${WEB}/upload-video`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (!response?.ok()) {
    throw new ProvisionError(`Não foi possível abrir a área de upload no perfil existente (HTTP ${response?.status() ?? "n/a"}). Nenhum dado foi gravado.`);
  }
  if (new URL(page.url()).origin !== WEB || /login|sign-in|signin/i.test(new URL(page.url()).pathname)) {
    throw new ProvisionError("O perfil ManyVids precisa de login válido no navegador. Nenhum dado foi gravado.");
  }
  const valid = await page.evaluate(async ({ api, web }) => {
    try {
      const auth = await fetch(`${api}/auth/token/v1`, { credentials: "include", cache: "no-store" });
      if (!auth.ok) return false;
      const body = await auth.json();
      if (body.error || body.success === false || typeof body.expiration !== "string" || !(Date.parse(body.expiration) > Date.now())) return false;
      const init = await fetch(`${web}/includes/init_session.php`, { credentials: "include", cache: "no-store" });
      if (!init.ok) return false;
      const token = await init.json();
      return !token.error && token.success !== false && typeof token.mvtoken === "string" && token.mvtoken.length > 0;
    } catch { return false; }
  }, { api: API, web: WEB });
  if (!valid) throw new ProvisionError("Não foi possível validar a sessão no próprio navegador. Faça login novamente nesse perfil ManyVids. Nenhum dado foi gravado.");
  const cookies = await context.cookies();
  const session: ManyVidsSessionData = { version: 1, creatorId: EXPECTED_CREATOR_ID, cookies: convertCookies(cookies) };
  const applicable = await context.cookies(`${API}/uploader/create`);
  assertBrowserCookieParity(session, applicable);
  if (!applicable.some(cookie => cookie.name === "mv.access-token" && cookie.value)) {
    throw new ProvisionError("O navegador não possui cookie de acesso aplicável à API. Faça login novamente nesse perfil. Nenhum dado foi gravado.");
  }
  console.log({ capturedCookieCount: session.cookies.length, capturedCookieNames: session.cookies.map(cookie => cookie.name), applicableCookieCount: applicable.length, applicableCookieNames: applicable.map(cookie => cookie.name) });
  return session;
}

async function dedicatedProfile(creatorId: string): Promise<string> {
  const safeId = creatorId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const root = await realpath(process.cwd());
  const intendedBase = path.join(root, ".manyvids-browser-profile");
  await mkdir(intendedBase, { recursive: true });
  const base = await realpath(intendedBase);
  if (base !== intendedBase) throw new ProvisionError("O diretório dedicado não pode apontar para outro perfil.");
  await mkdir(path.join(base, safeId), { recursive: true });
  const profile = await realpath(path.join(base, safeId));
  const relative = path.relative(base, profile);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ProvisionError("Perfil dedicado inválido.");
  }
  return profile;
}

export async function main(args: string[]): Promise<void> {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Ferramenta LOCAL/ADMIN. Não publica nem envia vídeos.");
    console.log("Uso: npm run manyvids:provision-session [-- --account-id <PlatformAccount.id>]");
    console.log("Sem --account-id: seleciona somente quando há uma conta correspondente inequívoca.");
    console.log("Abre Google Chrome visível com perfil exclusivo em .manyvids-browser-profile. Faça login manualmente e pressione Enter no terminal.");
    return;
  }
  if (args.length !== 0 && !(args.length === 2 && args[0] === "--account-id" && args[1].trim())) {
    console.error("Argumentos inválidos. Use --help; não passe cookies ou segredos pela linha de comando.");
    process.exitCode = 1;
    return;
  }

  let database: ReturnType<typeof createDatabase> | undefined;
  let context: BrowserContext | undefined;
  let saved = false;
  let phase = "configuração";
  try {
    // Keep Prisma's ESM imports native instead of converting them through the CJS bootstrap.
    const databaseModuleUrl = pathToFileURL(path.join(process.cwd(), "src/prisma/db.ts")).href;
    const { createDatabase } = await import(databaseModuleUrl) as typeof import("../src/prisma/db");
    database = createDatabase(process.env.DATABASE_URL ?? "");
    phase = "seleção da conta";
    const accounts = await database.orm.public.PlatformAccount.where({ platform: "MANYVIDS" }).all();
    const matches = accounts.filter((account) => account.externalAccountId === EXPECTED_CREATOR_ID);
    const candidates = matches.length ? matches : accounts.filter((account) => !account.externalAccountId);
    const account = args.length ? accounts.find((item) => item.id === args[1]) : candidates.length === 1 ? candidates[0] : undefined;
    if (!account) {
      for (const item of accounts) {
        const local = item.creatorId ? await database.orm.public.Creator.where({ id: item.creatorId, workspaceId: item.workspaceId }).first() : null;
        console.log({ platformAccountId: item.id, workspaceId: item.workspaceId, creatorId: item.creatorId, displayName: local?.displayName ?? null, status: item.status, externalAccountId: item.externalAccountId });
      }
      throw new ProvisionError("Não há uma conta ManyVids inequívoca. Confira a lista e execute com --account-id <PlatformAccount.id>.");
    }
    if (account.externalAccountId && account.externalAccountId !== EXPECTED_CREATOR_ID) {
      throw new ProvisionError("A conta selecionada está vinculada a outro creator remoto. Nenhum dado foi alterado.");
    }
    if (!account.creatorId) throw new ProvisionError("A conta ManyVids não possui creator local vinculado.");
    const [creator, workspace] = await Promise.all([
      database.orm.public.Creator.where({ id: account.creatorId, workspaceId: account.workspaceId }).first(),
      database.orm.public.Workspace.where({ id: account.workspaceId }).first(),
    ]);
    if (!creator || creator.status !== "ACTIVE" || !workspace || workspace.status !== "ACTIVE") {
      throw new ProvisionError("O vínculo workspace/creator não está ativo ou é inconsistente. Nenhum dado foi alterado.");
    }
    console.log({ platformAccountId: account.id, workspaceId: workspace.id, creatorId: creator.id, displayName: creator.displayName, status: account.status, externalAccountId: account.externalAccountId });
    console.log(`Creator remoto esperado (configurado): ${EXPECTED_CREATOR_ID}`);

    phase = "abertura do Chrome dedicado";
    const profile = await dedicatedProfile(creator.id);
    // Suppress inherited debugging before importing Playwright. No tracing or HAR.
    process.env.DEBUG = "";
    process.env.PWDEBUG = "";
    const { chromium } = await import("playwright");
    try {
      context = await chromium.launchPersistentContext(profile, {
        channel: "chrome",
        headless: false,
        serviceWorkers: "block",
        args: ["--disable-background-networking"],
      });
      await context.route("**/*", (route) => {
        const request = route.request();
        const url = new URL(request.url());
        // Allow manual login, but prevent creating/uploads/publishing from this browser.
        const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method());
        const publishing = /\/uploader\/|\/unified-media\/|\/v1\/store\/videos|\/includes\/saveVideo\.php/.test(url.pathname);
        return mutation && (publishing || request.method() === "PUT") ? route.abort() : route.continue();
      });
    } catch {
      throw new ProvisionError("Não foi possível abrir Google Chrome instalado com o perfil dedicado. Verifique a instalação e se esse perfil já está aberto. Seu perfil pessoal não é utilizado.");
    }
    console.log("Navegador: Google Chrome instalado (channel=chrome), perfil exclusivo da Creator Platform.");
    const loginPage = await context.newPage();
    await loginPage.goto(WEB, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await loginPage.bringToFront();
    const prompt = createInterface({ input: stdin, output: stdout });
    try { await prompt.question("Faça login manualmente na conta ManyVids correta no Chrome aberto. Depois pressione Enter aqui para validar e salvar: "); }
    finally { prompt.close(); }
    phase = "validação da sessão";
    const session = await captureBrowserSession(context);
    let encrypted: string;
    try {
      encrypted = encryptManyVidsSession(session);
      const restored = decryptManyVidsSession(encrypted, EXPECTED_CREATOR_ID);
      if (!isDeepStrictEqual(restored, session)) throw new Error("SESSION_ROUNDTRIP_MISMATCH");
      assertBrowserCookieParity(restored, await context.cookies(`${API}/uploader/create`));
    } catch {
      throw new ProvisionError("Verifique PLATFORM_TOKEN_ENCRYPTION_KEY e a compatibilidade dos cookies com o contrato HTTP. Nenhum dado foi gravado.");
    }
    await context.close();
    context = undefined;

    phase = "gravação da conta";
    await database.transaction(async (tx) => {
      // Serialize against the publisher's account lock. Do not replace credentials mid-publication.
      await tx.orm.public.PlatformAccount.where({ id: account.id, platform: "MANYVIDS", workspaceId: workspace.id }).update({ id: account.id });
      const running = await tx.orm.public.PlatformPublication.where({ platformAccountId: account.id, status: "PROCESSING" }).first();
      const publishing = await tx.orm.public.PlatformPublication.where({ platformAccountId: account.id, status: "PUBLISHING" }).first();
      if (running || publishing) throw new ProvisionError("Há uma publicação em processamento nesta conta. Aguarde ou revise seu estado antes do provisionamento.");
      const updated = await tx.orm.public.PlatformAccount.where({
        id: account.id, platform: "MANYVIDS", workspaceId: workspace.id, creatorId: creator.id,
        externalAccountId: account.externalAccountId, accessTokenEncrypted: account.accessTokenEncrypted,
      }).updateAndCount({
        externalAccountId: EXPECTED_CREATOR_ID,
        status: "CONNECTED",
        accessTokenEncrypted: encrypted,
        lastVerifiedAt: new Date().toISOString(),
        lastErrorCode: null,
        lastErrorMessage: null,
      });
      if (updated !== 1) throw new ProvisionError("A conta foi alterada durante a validação. Nenhum dado foi sobrescrito; execute novamente após conferir a conta.");
    });
    saved = true;
    console.log("Sessão validada e cifrada na PlatformAccount selecionada. Nenhuma publicação ou upload foi executado.");
  } catch (error) {
    if (error instanceof ProvisionError) {
      console.error(error.message);
    } else {
      const name = error !== null && typeof error === "object" && "name" in error ? error.name : undefined;
      const code = error !== null && typeof error === "object" && "code" in error ? error.code : undefined;
      const safeIdentifier = (value: unknown) =>
        (typeof value === "string" && /^[A-Za-z0-9_.-]{1,100}$/.test(value)) ||
        (typeof value === "number" && Number.isFinite(value)) ? String(value) : "n/a";
      console.error(`Falha durante ${phase}.\nTipo: ${safeIdentifier(name)}\nCódigo: ${safeIdentifier(code)}`);
    }
    process.exitCode = 1;
  } finally {
    if (context) {
      try { await context.close(); } catch {
        console.error("Não foi possível confirmar o fechamento do contexto aberto pela ferramenta. Verifique o Chromium local.");
        process.exitCode = 1;
      }
    }
    if (database) {
      try { await database.close(); } catch {
        console.error(saved ? "A sessão foi gravada, mas houve falha ao fechar a conexão local do banco." : "Houve falha ao fechar a conexão local do banco.");
        process.exitCode = 1;
      }
    }
  }
}
