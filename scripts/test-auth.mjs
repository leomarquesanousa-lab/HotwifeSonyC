// Isolated service tests: in-memory database, mocked cookies and provider. Never loads .env.
import assert from "node:assert/strict";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import argon2 from "argon2";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = `
export const state = { tables: {}, cookie: null, failTable: null };
let queue = Promise.resolve();
let serial = 0;
const rows = name => state.tables[name] ??= [];
function query(name, filters = [], limit = Infinity) {
  const matching = () => rows(name).filter(row => filters.every(f => f(row))).slice(0, limit);
  return {
    where(condition) {
      const predicate = typeof condition === 'function' ? row => condition(new Proxy({}, {get: (_, key) => ({gt: v => row[key] > v, gte: v => row[key] >= v, neq: v => row[key] !== v, eq: v => row[key] === v})})) : row => Object.entries(condition).every(([k,v]) => row[k] === v);
      return query(name, [...filters, predicate], limit);
    },
    select() { return this; }, limit(n) { return query(name, filters, n); },
    async first() { return structuredClone(matching()[0] ?? null); },
    async all() { return structuredClone(matching()); },
    async updateAndCount(values) { const items = matching(); items.forEach(row => Object.assign(row, values)); return items.length; },
    async create(values) { if(state.failTable === name) throw Error('fixture failure'); const row = {id: 'fixture-' + (++serial), usedAt: null, revokedAt: null, createdAt: new Date().toISOString(), ...values}; rows(name).push(row); return structuredClone(row); }
  };
}
export const db = {
  orm: {public: new Proxy({}, { get: (_, name) => query(name) })},
  raw: {sql() {return {returnsRow() {return this}, build() {return {}}}}},
  async transaction(fn) {
    let release; const previous = queue; queue = new Promise(resolve => release = resolve); await previous;
    const before = structuredClone(state.tables);
    try {return await fn({orm: db.orm, execute: async () => {}})} catch(e) {state.tables = before; throw e} finally {release()}
  }
};
export async function cookies() {return {get: () => state.cookie ? {value: state.cookie} : undefined}};
`;
const result = await build({
  stdin: {
    contents: `
export * from './src/lib/auth/tokens';
export * from './src/lib/auth/request';
export * from './src/lib/auth/password-hash';
export * from './src/lib/auth/confirmation';
export * from './src/lib/auth/registration';
export * from './src/lib/auth/recovery';
export * from './src/lib/auth/password-management';
export * from './src/lib/auth/session';
export * from './src/lib/auth/rate-limit';
export * from './src/lib/auth/login';
export * from './src/lib/email/client';
export * from './src/lib/email/config';
export * from './src/lib/email/templates/auth-email';
export {state} from 'auth-fixture';`,
    resolveDir: root,
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  write: false,
  logLevel: "silent",
  plugins: [
    {
      name: "isolate-auth",
      setup(build) {
        build.onResolve(
          { filter: /(?:prisma\/db$|^next\/headers$|^auth-fixture$)/ },
          () => ({ path: "fixture", namespace: "fixture" }),
        );
        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: fixture,
          loader: "js",
        }));
      },
    },
  ],
});
const filename = path.join(root, "scripts", "auth-tests.memory.cjs");
const loaded = new Module(filename);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(root);
loaded._compile(result.outputFiles[0].text, filename);
const a = loaded.exports;
const saved = {
  fetch: globalThis.fetch,
  info: console.info,
  error: console.error,
};
const logs = [];
console.info = (...args) => logs.push(args);
console.error = (...args) => logs.push(args);
process.env.RESEND_API_KEY = "fixture-key";
process.env.EMAIL_FROM = "Creator <no-reply@example.invalid>";
process.env.APP_URL = "https://app.example.invalid";
process.env.NODE_ENV = "test";
let sends = 0;
let providerStatus = 200;
globalThis.fetch = async (url) => {
  assert.equal(String(url), "https://api.resend.com/emails");
  sends++;
  return new Response(
    JSON.stringify(
      providerStatus === 200
        ? { id: "fixture-message" }
        : { name: "validation_error", message: "sensitive provider body" },
    ),
    { status: providerStatus, headers: { "content-type": "application/json" } },
  );
};
const request = (body, headers = {}) =>
  new Request("https://app.example.invalid/api/auth/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://app.example.invalid",
      ...headers,
    },
    body: JSON.stringify(body),
  });
const reset = () => {
  a.state.tables = {};
  a.state.cookie = null;
  a.state.failTable = null;
  sends = 0;
  providerStatus = 200;
};
const password = "Fixture-Password123!";
const registration = {
  email: "fixture@example.invalid",
  firstName: "Test",
  lastName: "Account",
  password,
  confirmPassword: password,
  acceptedTerms: true,
  accountType: "CREATOR",
  locale: "cs-CZ",
};
let passed = 0;
async function test(name, run) {
  reset();
  await run();
  passed++;
  process.stdout.write(`PASS ${name}\n`);
}
try {
  await test("token entropy, hashing, expiry and single-use predicates", async () => {
    const one = a.newAuthToken(60_000),
      two = a.newAuthToken(60_000);
    assert.match(one.token, /^[a-f0-9]{64}$/);
    assert.notEqual(one.token, two.token);
    assert.equal(a.hashAuthToken(one.token), one.tokenHash);
    assert.equal(
      a.usableToken({ expiresAt: one.expiresAt, usedAt: null }),
      true,
    );
    for (const token of [
      null,
      { expiresAt: new Date(0).toISOString(), usedAt: null },
      { expiresAt: "invalid", usedAt: null },
      { expiresAt: one.expiresAt, usedAt: one.expiresAt },
    ])
      assert.equal(a.usableToken(token), false);
  });
  let hash;
  await test("existing native Argon2 hashes remain compatible in both directions", async () => {
    hash = await a.hashPassword(password);
    assert.equal(await argon2.verify(hash, password), true);
    const native = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    assert.equal(await a.verifyPassword(native, password), true);
    assert.equal(await a.verifyPassword(native, "wrong"), false);
  });
  await test("CSRF, non-JSON and malformed inputs rejected before mutations", async () => {
    assert.equal(
      (
        await a.register(
          request(registration, { origin: "https://evil.invalid" }),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await a.register(
          request(registration, { "content-type": "text/plain" }),
        )
      ).status,
      415,
    );
    assert.equal((await a.register(request({}))).status, 400);
    assert.deepEqual(a.state.tables, {});
    assert.equal(sends, 0);
  });
  await test("registration mail failure preserves one pending account and allows recovery", async () => {
    providerStatus = 403;
    const response = await a.register(request(registration));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).accountCreated, true);
    assert.equal(a.state.tables.User[0].status, "PENDING");
    assert.equal(a.state.tables.EmailVerificationToken.length, 1);
    assert.equal(a.state.tables.EmailVerificationToken[0].token, undefined);
    assert.equal((await a.register(request(registration))).status, 409);
    assert.equal(a.state.tables.User.length, 1);
  });
  await test("registration transaction rolls back user/workspace when token creation fails", async () => {
    a.state.failTable = "EmailVerificationToken";
    assert.equal((await a.register(request(registration))).status, 500);
    assert.equal(a.state.tables.User?.length ?? 0, 0);
    assert.equal(a.state.tables.Workspace?.length ?? 0, 0);
    assert.equal(sends, 0);
  });
  await test("verification concurrent reuse has exactly one success; suspended users stay suspended", async () => {
    const token = a.newAuthToken(60_000);
    a.state.tables.User = [{ id: "u", status: "PENDING" }];
    a.state.tables.EmailVerificationToken = [
      { id: "t", userId: "u", ...token, usedAt: null },
    ];
    const results = await Promise.all([
      a.verifyEmail(request({ token: token.token })),
      a.verifyEmail(request({ token: token.token })),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
    assert.equal(a.state.tables.User[0].status, "ACTIVE");
    assert.ok(a.state.tables.User[0].emailVerifiedAt);
    a.state.tables.User[0].status = "SUSPENDED";
    a.state.tables.EmailVerificationToken[0].usedAt = null;
    assert.equal(
      (await a.verifyEmail(request({ token: token.token }))).status,
      400,
    );
    assert.equal(a.state.tables.User[0].status, "SUSPENDED");
  });
  await test("expired verification and reset tokens cannot mutate users", async () => {
    const token = a.newAuthToken(-1000);
    a.state.tables.User = [{ id: "u", status: "PENDING", passwordHash: hash }];
    for (const table of ["EmailVerificationToken", "PasswordResetToken"])
      a.state.tables[table] = [
        { id: "t", userId: "u", ...token, usedAt: null },
      ];
    assert.equal(
      (await a.verifyEmail(request({ token: token.token }))).status,
      400,
    );
    assert.equal(
      (
        await a.resetPassword(
          request({ token: token.token, password, confirmPassword: password }),
        )
      ).status,
      400,
    );
    assert.equal(a.state.tables.User[0].status, "PENDING");
    assert.equal(a.state.tables.User[0].passwordHash, hash);
  });
  await test("resend and forgot use identical public responses for missing users and provider failures", async () => {
    for (const kind of ["resend", "forgot"]) {
      reset();
      const missing = await a.requestRecovery(
        request({ email: registration.email }),
        kind,
      );
      const body = await missing.json();
      assert.equal(sends, 0);
      a.state.tables.User = [
        {
          id: "u",
          email: registration.email,
          status: "PENDING",
          emailVerifiedAt: null,
          locale: "cs-CZ",
        },
      ];
      providerStatus = 403;
      const failed = await a.requestRecovery(
        request({ email: registration.email }),
        kind,
      );
      assert.equal(failed.status, missing.status);
      assert.deepEqual(await failed.json(), body);
      assert.ok(
        a.state.tables.AuditLog.some((row) =>
          row.action.endsWith("EMAIL_FAILED"),
        ),
      );
      providerStatus = 200;
      assert.equal(
        (await a.requestRecovery(request({ email: registration.email }), kind))
          .status,
        200,
      );
      const tokens =
        a.state.tables[
          kind === "resend" ? "EmailVerificationToken" : "PasswordResetToken"
        ];
      assert.equal(tokens.length, 2);
      assert.notEqual(tokens[0].tokenHash, tokens[1].tokenHash);
    }
  });
  await test("rate limit serializes concurrent requests and ignores untrusted forwarded headers", async () => {
    assert.equal(
      a.getRequestIp(request({}, { "x-forwarded-for": "spoofed" })),
      null,
    );
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        a.checkAuthRateLimit("resend", request({}), "same@example.invalid"),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
    assert.equal(
      results.filter(
        (r) => r.status === "rejected" && r.reason.code === "RATE_LIMITED",
      ).length,
      3,
    );
  });
  await test("password reset consumes sibling tokens and revokes only that user's sessions", async () => {
    const token = a.newAuthToken(60_000);
    a.state.tables.User = [{ id: "u", status: "ACTIVE", passwordHash: "old" }];
    a.state.tables.PasswordResetToken = [
      { id: "t", userId: "u", ...token, usedAt: null },
      { id: "sibling", userId: "u", usedAt: null },
    ];
    a.state.tables.Session = [
      { id: "s", userId: "u", status: "ACTIVE" },
      { id: "other", userId: "other", status: "ACTIVE" },
    ];
    assert.equal(
      (
        await a.resetPassword(
          request({ token: token.token, password, confirmPassword: password }),
        )
      ).status,
      200,
    );
    assert.equal(
      await a.verifyPassword(a.state.tables.User[0].passwordHash, password),
      true,
    );
    assert.ok(a.state.tables.PasswordResetToken.every((t) => t.usedAt));
    assert.equal(a.state.tables.Session[0].status, "REVOKED");
    assert.equal(a.state.tables.Session[1].status, "ACTIVE");
    assert.equal(
      (
        await a.resetPassword(
          request({ token: token.token, password, confirmPassword: password }),
        )
      ).status,
      400,
    );
  });
  await test("session compatibility, logout and stale-password login protection", async () => {
    a.state.tables.User = [{ id: "u", status: "ACTIVE", passwordHash: hash }];
    const created = await a.createSession("u", hash, {
      ipAddress: null,
      userAgent: null,
      clientType: "WEB",
    });
    a.state.cookie = created.sessionToken;
    assert.equal((await a.getCurrentSession()).user.id, "u");
    assert.equal(a.SESSION_DURATION_SECONDS, 2592000);
    assert.equal(a.SESSION_COOKIE_NAME, "creator_session");
    assert.equal((await a.logout(request({}))).status, 200);
    assert.equal(await a.getCurrentSession(), null);
    await assert.rejects(
      a.createSession("u", "stale-hash", {
        ipAddress: null,
        userAgent: null,
        clientType: "WEB",
      }),
      { code: "INVALID_CREDENTIALS" },
    );
  });
  await test("change password requires current password and keeps only current session", async () => {
    a.state.tables.User = [{ id: "u", status: "ACTIVE", passwordHash: hash }];
    const first = await a.createSession("u", hash, {
      ipAddress: null,
      userAgent: null,
      clientType: "WEB",
    });
    await a.createSession("u", hash, {
      ipAddress: null,
      userAgent: null,
      clientType: "WEB",
    });
    a.state.cookie = first.sessionToken;
    assert.equal(
      (
        await a.changePassword(
          request({
            currentPassword: "wrong",
            password,
            confirmPassword: password,
          }),
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await a.changePassword(
          request({
            currentPassword: password,
            password,
            confirmPassword: password,
          }),
        )
      ).status,
      200,
    );
    assert.deepEqual(
      a.state.tables.Session.map((s) => s.status),
      ["ACTIVE", "REVOKED"],
    );
  });
  await test("login wrong-password and pending-account responses preserve existing behavior", async () => {
    a.state.tables.User = [
      {
        id: "u",
        email: registration.email,
        status: "PENDING",
        passwordHash: hash,
      },
    ];
    assert.equal(
      (await a.login(request({ email: registration.email, password: "wrong" })))
        .status,
      401,
    );
    const response = await a.login(
      request({ email: registration.email, password }),
    );
    assert.equal((await response.json()).error, "EMAIL_NOT_VERIFIED");
    assert.equal(a.state.tables.Session?.length ?? 0, 0);
  });
  await test("five-locale templates escape names and attribute values", async () => {
    for (const locale of ["en-US", "pt-BR", "es-ES", "fr-FR", "cs-CZ"])
      for (const kind of ["verification", "reset"]) {
        const template = await a.authEmailTemplate(
          kind,
          locale,
          '<img src=x onerror="attack">',
          'https://example.invalid/?a="&b=1',
        );
        assert.ok(template.subject);
        assert.ok(template.text);
        assert.ok(!template.html.includes("<img"));
        assert.ok(template.html.includes("&lt;img"));
        assert.ok(template.html.includes("&quot;&amp;b=1"));
      }
  });
  await test("transport retries reuse idempotency key and never expose raw errors", async () => {
    let attempts = 0;
    const keys = [];
    const message = {
      to: "test@example.invalid",
      subject: "test",
      text: "test",
      html: "test",
    };
    await a.sendEmail(message, "stable-key", async (_, key) => {
      keys.push(key);
      if (++attempts === 1) throw Error("secret");
      return { data: { id: "safe-id" }, error: null };
    });
    assert.deepEqual(keys, ["stable-key", "stable-key"]);
    await assert.rejects(
      a.sendEmail(message, "key", async () => {
        throw Error("secret");
      }),
      { code: "EMAIL_TRANSPORT_FAILED", message: "EMAIL_TRANSPORT_FAILED" },
    );
    assert.throws(
      () =>
        a.emailConfiguration({
          RESEND_API_KEY: "fixture",
          EMAIL_FROM: "x@example.invalid",
          APP_URL: "https://user:password@example.invalid",
        }),
      { code: "EMAIL_BASE_URL_INVALID" },
    );
    process.env.NODE_ENV = "production";
    assert.throws(
      () =>
        a.emailConfiguration({
          RESEND_API_KEY: "fixture",
          EMAIL_FROM: "x@example.invalid",
          APP_URL: "http://localhost:3000",
        }),
      { code: "EMAIL_BASE_URL_INVALID" },
    );
    process.env.NODE_ENV = "test";
  });
  assert.ok(!JSON.stringify(logs).includes(password));
  assert.ok(!JSON.stringify(logs).includes("sensitive provider body"));
  process.stdout.write(
    `Auth tests: ${passed} passed; no real database or email operations.\n`,
  );
} finally {
  globalThis.fetch = saved.fetch;
  console.info = saved.info;
  console.error = saved.error;
}
