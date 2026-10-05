// Temporary local diagnostic. Reads an existing video's status; never creates or edits video.
import { build } from "esbuild";
import Module from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function summarizeResponse(value, depth = 0) {
  const kind = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (depth >= 4 || kind !== "object") return { kind, ...(kind === "array" ? { length: value.length } : {}) };
  return {
    kind,
    fields: Object.entries(value).slice(0, 40).map(([key, item]) => {
      // Unknown keys may themselves contain user data. Only simple field identifiers are shown.
      const name = /^[A-Za-z_][A-Za-z_0-9]{0,39}$/.test(key) ? key : "[redacted-field]";
      const result = { name, kind: Array.isArray(item) ? "array" : item === null ? "null" : typeof item };
      if (/url|path|file|src/i.test(key)) result.present = item != null && item !== "";
      if (typeof item === "string" && /https?:\/\/|^\//i.test(item)) result.urlOrPathPresent = true;
      if (/^(status|state|progress|ready|complete|completed|success|processing|done|error|statusCode)$/i.test(key)) {
        if (typeof item === "boolean" || item === null) result.value = item;
        else if (typeof item === "number" && Number.isFinite(item) && item >= 0 && item <= 599) result.value = item;
        else if (typeof item === "string" && /^(pending|processing|queued|ready|complete|completed|success|successful|failed|error|done|true|false|ok|waiting|[0-9]{1,3})$/i.test(item)) result.value = item;
      }
      if (item && typeof item === "object") result.structure = summarizeResponse(item, depth + 1);
      return result;
    }),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--video-id" || !/^\d+$/.test(args[1]) || args[2] !== "--origin-etag" || !/^[A-Za-z0-9_-]{1,150}$/.test(args[3])) {
    console.error("Uso: node scripts/diagnose-manyvids-teaser.mjs --video-id <ID existente> --origin-etag <ETag remoto desse vídeo>");
    process.exitCode = 1;
    return;
  }
  let database;
  const originalWarn = console.warn, originalInfo = console.info;
  try {
    // Native import preserves this project's Prisma ESM runtime.
    const { createDatabase } = await import(pathToFileURL(path.resolve("src/prisma/db.ts")).href);
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set("options", "-c default_transaction_read_only=on");
    database = createDatabase(url.toString());
    const publications = await database.orm.public.PlatformPublication.where({ platform: "MANYVIDS", externalPostId: args[1] }).all();
    const accountIds = [...new Set(publications.map(row => row.platformAccountId))];
    if (accountIds.length !== 1) throw Error();
    const account = await database.orm.public.PlatformAccount.where({ id: accountIds[0], platform: "MANYVIDS" }).first();
    if (!account) throw Error();
    const bundled = await build({
      stdin: { resolveDir: process.cwd(), contents: "export * from './src/lib/platforms/manyvids/http/client';export * from './src/lib/platforms/manyvids/http/session'" },
      bundle: true, platform: "node", format: "cjs", packages: "external", write: false, logLevel: "silent",
    });
    const filename = path.resolve("scripts/teaser-diagnostic.memory.cjs");
    const loaded = new Module(filename);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(process.cwd());
    loaded._compile(bundled.outputFiles[0].text, filename);
    const a = loaded.exports;
    let cycle = 0;
    const transport = async (target, init) => {
      const remote = new URL(target);
      const isStatus = remote.pathname === "/includes/get_edit_preview_vid_status.php" && init.method === "POST";
      const isToken = remote.pathname === "/includes/init_session.php" && (init.method ?? "GET") === "GET";
      if (remote.origin !== a.WEB || (!isStatus && !isToken)) throw Error();
      const response = await fetch(target, init);
      if (isStatus) {
        const text = await response.clone().text();
        let body = text;
        try { body = JSON.parse(text); } catch { /* Text stays opaque. */ }
        console.log(JSON.stringify({ cycle, httpStatus: response.status, response: summarizeResponse(body) }));
      }
      return response;
    };
    console.warn = () => {};
    console.info = () => {};
    const client = new a.ManyVidsClient(a.decryptManyVidsSession(account.accessTokenEncrypted, account.externalAccountId), async () => {}, transport);
    for (cycle = 1; cycle <= 3; cycle++) {
      await client.form("/includes/get_edit_preview_vid_status.php", "TEASER", new URLSearchParams({ video_id: args[1], origin_Etag: args[3], initialTranscode: "false" }));
      if (cycle < 3) await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch {
    console.error("Diagnóstico interrompido. Nenhum upload, save ou publicação foi executado.");
    process.exitCode = 1;
  } finally {
    console.warn = originalWarn;
    console.info = originalInfo;
    if (database) await database.close().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
