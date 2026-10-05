// Offline authentication regression tests. Synthetic credentials, no database or network.
import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const fixture = `
export const state={account:null,conflict:false,writes:0};
export async function getCurrentSession(){return {user:{id:'fixture-user'}};}
export const db={orm:{public:{
PlatformAccount:{where(filter){return {
async first(){return structuredClone(state.account)},
async updateAndCount(values){
 if(state.conflict || state.account.accessTokenEncrypted!==filter.accessTokenEncrypted)return 0;
 Object.assign(state.account,values);state.writes++;return 1;
}}}},
WorkspaceMember:{where(){return {async first(){return {id:'fixture-member'}}}}}
}}};
`;
const result = await build({
  stdin: {resolveDir: root, contents: `
export * from './src/lib/platforms/manyvids/http/session';
export * from './src/lib/platforms/manyvids/http/client';
export {convertCookies, assertBrowserCookieParity, captureBrowserSession} from './scripts/provision-manyvids-session';
export {GET} from './app/api/distribution/manyvids/tags/route';
export {state} from 'session-fixture';`},
  bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  plugins: [{name: "isolate", setup(b) {
    b.onResolve({filter: /(?:prisma\/db$|lib\/auth\/session$|^session-fixture$)/}, () => ({path: "fixture", namespace: "fixture"}));
    b.onLoad({filter: /.*/, namespace: "fixture"}, () => ({contents: fixture, loader: "js"}));
  }}],
});
const loadedModule = new Module(path.join(root, "scripts/session-tests.memory.cjs"));
loadedModule.filename = path.join(root, "scripts/session-tests.memory.cjs");
loadedModule.paths = Module._nodeModulePaths(root);
loadedModule._compile(result.outputFiles[0].text, loadedModule.filename);
const a = loadedModule.exports;
const originalFetch = globalThis.fetch, originalWarn = console.warn;
const originalKey = process.env.PLATFORM_TOKEN_ENCRYPTION_KEY;
process.env.PLATFORM_TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
globalThis.fetch = async () => {throw Error("Network forbidden");};
try {
  const cookies = a.convertCookies([
    {name: "root", value: "fixture", domain: ".manyvids.com", path: "/", expires: -1},
    {name: "web", value: "fixture", domain: "www.manyvids.com", path: "/", expires: -1},
    {name: "api", value: "fixture", domain: "api.manyvids.com", path: "/auth", expires: -1},
    {name: "expired", value: "fixture", domain: ".manyvids.com", path: "/", expires: 1},
    {name: "other", value: "fixture", domain: "example.com", path: "/", expires: -1},
  ]);
  const session = {version: 1, creatorId: "123", cookies};
  assert.equal(cookies.length, 3);
  const restored = a.decryptManyVidsSession(a.encryptManyVidsSession(session), "123");
  assert.deepEqual(restored, session);
  const jar = new a.ManyVidsCookieJar(restored);
  assert.equal(jar.header(new URL(a.API + "/auth/token/v1")), "api=fixture; root=fixture");
  assert.equal(jar.header(new URL(a.API + "/tags/partial/test")), "root=fixture");
  assert.equal(jar.header(new URL(a.WEB + "/")), "root=fixture; web=fixture");
  console.log("Cookies: conversão, domínio, hostOnly, path, expiração e cifragem aprovados.");

  const completeBrowserCookies = ["_ga", "MSG_LEG_TKN", "KGID", "timezone", "seenWarningPage", "PHPSESSID", "XSRF-TOKEN", "mv.access-token"].map(name => ({
    name, value: "synthetic-fixture", domain: ".manyvids.com", path: "/", expires: -1,
    secure: true, httpOnly: true, sameSite: "None",
  }));
  const completeSession = {version: 1, creatorId: "1011541738", cookies: a.convertCookies(completeBrowserCookies)};
  const restoredComplete = a.decryptManyVidsSession(a.encryptManyVidsSession(completeSession), completeSession.creatorId);
  assert.deepEqual(restoredComplete, completeSession);
  assert.equal(new a.ManyVidsCookieJar(restoredComplete).header(new URL("http://api.manyvids.com/uploader/create")), "");
  const subdomainCookies = a.convertCookies([{name: "fixture", value: "fixture", domain: ".auth.manyvids.com", path: "/", expires: 4102444800, secure: true, httpOnly: false, sameSite: "Lax"}]);
  assert.deepEqual(a.decryptManyVidsSession(a.encryptManyVidsSession({version:1,creatorId:"123",cookies:subdomainCookies}), "123").cookies, subdomainCookies);
  assert.equal(new a.ManyVidsCookieJar({version:1,creatorId:"123",cookies:subdomainCookies}).header(new URL(a.API)), "");
  a.assertBrowserCookieParity(restoredComplete, completeBrowserCookies);
  assert.throws(() => a.assertBrowserCookieParity({...restoredComplete, cookies: restoredComplete.cookies.slice(1)}, completeBrowserCookies));
  const events = [];
  const browserContext = {
    async newPage() { return {
      async goto() {events.push("navigate");return {ok:()=>true}},
      url:()=>"https://www.manyvids.com/upload-video",
      async evaluate() {events.push("validate-in-browser");return true},
    }},
    async cookies() {events.push("capture");return completeBrowserCookies},
  };
  assert.deepEqual(await a.captureBrowserSession(browserContext), completeSession);
  assert.deepEqual(events, ["navigate", "validate-in-browser", "capture", "capture"]);
  const rejectedContext = {async newPage(){return {async goto(){return {ok:()=>false,status:()=>403}}}}, async cookies(){throw Error("Must not capture an unvalidated session")}};
  await assert.rejects(a.captureBrowserSession(rejectedContext), /HTTP 403/);
  console.log("Provisionamento: conjunto completo preservado, captura após validação no navegador e recusa antes de gravar sessão inválida.");

  const calls = [];
  const client = new a.ManyVidsClient(restored, async () => {}, async (url, init) => {
    calls.push({url: String(url), cookie: new Headers(init.headers).get("Cookie")});
    return Response.json({expiration: "2099-01-01T00:00:00Z"});
  });
  await client.refresh();
  await client.request(a.API, "/auth/token/v1", "SESSION");
  assert.deepEqual(calls[0], calls[1]);
  console.log("Provisionador/refresh: mesmo endpoint e mesmos cookies.");

  for (const status of [401, 403, 302]) {
    const logs = [];
    console.warn = (...args) => logs.push(args);
    const rejected = new a.ManyVidsClient(session, async () => {}, async () => new Response("secret-body", {
      status, headers: {"cf-mitigated": "challenge", location: "https://example.com/secret"},
    }));
    await assert.rejects(rejected.refresh(), {code: "SESSION_REJECTED"});
    assert.deepEqual(logs, [["MANYVIDS_REQUEST_REJECTED", {
      stage: "SESSION", host: "API", method: "GET", path: "/auth/token/v1",
      upstreamStatus: status, server: null, contentType: "text/plain;charset=UTF-8",
      via: null, xCache: null, challengeDetected: true, redirectPresent: true,
      apiCookieCount: 2, cookieNames: ["api", "root"], hasAccessToken: false,
      responseBytes: 11,
    }]]);
  }
  console.warn = originalWarn;
  console.log("Diagnóstico: 401/403/redirect distinguíveis sem corpo, cookies ou tokens.");

  function seed(conflict = false) {
    a.state.account = {id: "fixture-account", workspaceId: "fixture-workspace", externalAccountId: "123", accessTokenEncrypted: a.encryptManyVidsSession(session)};
    a.state.writes = 0; a.state.conflict = conflict;
  }
  let requests = 0;
  globalThis.fetch = async (url) => {
    requests++;
    const auth = new URL(url).pathname === "/auth/token/v1";
    return Response.json(auth ? {expiration: "2099-01-01T00:00:00Z"} : [{id: 1, name: "Fixture"}], {
      headers: {"set-cookie": `rotation=${auth ? "first" : "second"}; Domain=.manyvids.com; Path=/`},
    });
  };
  const request = {nextUrl: new URL("http://localhost/api?platformAccountId=fixture-account&keywords=test")};
  seed();
  assert.equal((await a.GET(request)).status, 200);
  assert.equal(a.state.writes, 2);
  assert.equal(a.decryptManyVidsSession(a.state.account.accessTokenEncrypted, "123").cookies.find(c => c.name === "rotation").value, "second");
  seed(true); requests = 0;
  const before = a.state.account.accessTokenEncrypted;
  const conflict = await a.GET(request);
  assert.equal((await conflict.json()).error, "ACCOUNT_SESSION_CHANGED");
  assert.equal(a.state.account.accessTokenEncrypted, before);
  assert.equal(requests, 1);
  console.log("Tags: duas rotações persistidas e conflito concorrente interrompido sem sobrescrita.");
} finally {
  globalThis.fetch = originalFetch; console.warn = originalWarn;
  if (originalKey === undefined) delete process.env.PLATFORM_TOKEN_ENCRYPTION_KEY;
  else process.env.PLATFORM_TOKEN_ENCRYPTION_KEY = originalKey;
}
