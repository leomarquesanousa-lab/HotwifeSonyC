import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { API, WEB, ManyVidsClient, jsonBody } from "./client";
import { ManyVidsCookieJar, type ManyVidsSessionData } from "./session";
import { buildSaveFields, resolveTags, searchTags } from "./metadata";
import { associatePerformer, performerSaveFields } from "./performers";
import { validateLocalOptions, type LocalOptions } from "./local-options";
import { confirmedVideo, confirmPublication, publishManyVids } from "./publish";
import { publishInputSchema, requireSupported, safeError, unwrapData } from "./types";
import { uploadVideo, validateSignedUploadUrl } from "./upload";
import { generateTeaser, teaserPollingState } from "./media-processing";
import { ManyVidsTiming } from "./timing";

test("timing preserves results/errors and logs only safe durations and transfer counters", async () => {
  let now = 0;
  const timing = new ManyVidsTiming(() => now);
  const logs: Record<string, unknown>[] = [];
  const original = console.info;
  console.info = (_label, entry) => { logs.push(entry); };
  try {
    const result = await timing.measure("VIDEO_TRANSFER", async () => { now = 2000; return "secret-result"; }, { partNumber: 1, bytes: 4_000_000, fileSizeBytes: 8_000_000 });
    assert.equal(result, "secret-result");
    assert.equal(logs[0].stage, "VIDEO_TRANSFER_START");
    assert.equal(logs[1].stage, "VIDEO_TRANSFER_END");
    assert.equal(logs[1].durationMs, 2000);
    assert.equal(logs[1].throughputMBps, 2);
    assert.equal(logs[1].elapsedMs, 2000);
    assert.equal(logs[1].runId, logs[0].runId);
    const failure = new Error("secret-error");
    await assert.rejects(timing.measure("SAVE", async () => { now = 2500; throw failure; }), error => error === failure);
    assert.equal(logs[3].success, false);
    assert.equal(logs[3].durationMs, 500);
    assert.equal(JSON.stringify(logs).includes("secret"), false);
    console.info = () => { throw new Error("logger failure"); };
    assert.equal(await timing.measure("SAVE", async () => 123), 123);
  } finally { console.info = original; }
});

test("teaser waits for the expected video's preview, redacts logs and never calls private", async () => {
  const body = {success: true, pendingVid: [{vid:"789",p: 0, pr: "1", cs: "2", e: "0", ptxt: "secret-fixture", etxt: "", video_preview_mp4: "https://example.com/secret-fixture", video_preview_html: "secret-fixture"}]};
  const safe = teaserPollingState(body, "789");
  assert.equal(JSON.stringify(safe).includes("secret-fixture"), false);
  assert.equal(safe.video_preview_mp4Present, true);
  assert.equal(teaserPollingState({...body,success:"true"}, "789").success, false);
  assert.equal(teaserPollingState({success:true,pendingVid:[{id:"789",vid:"999",video_preview_mp4:"/other"}]}, "789").expectedVideoFound, false);
  const calls: string[] = [], logs: unknown[][] = [];
  const info = console.info, warn = console.warn;
  console.info = (...args: unknown[]) => { logs.push(args); };
  console.warn = () => {};
  try {
    let polls = 0;
    const client = new ManyVidsClient(structuredClone(session), async () => {}, async (value) => {
      const url = new URL(String(value)); calls.push(url.pathname);
      if (url.pathname === "/includes/init_session.php") return Response.json({mvtoken: "fixture"});
      if (url.pathname === "/api/video/preview") return Response.json({success: true});
      if (url.pathname === "/includes/get_edit_preview_vid_status.php") return Response.json(++polls === 1 ? {success:true,pendingVid:[{vid:"999",video_preview_mp4:"/other"},{vid:"789",p:0,pr:"1",cs:"2",e:"0",video_preview_mp4:"  "}]} : body);
      throw new Error("Teaser must not call other endpoints");
    });
    const clock = pollingClock();
    await generateTeaser(client, {bucket:"fixture",key:"123/file",etag:"fixture"}, "789", 0, clock);
    assert.equal(calls.filter(p => p === "/includes/get_edit_preview_vid_status.php").length, 2);
    assert.equal(calls.filter(p => p === "/store/video/789/private").length, 0);
    const observations = logs.filter(row => row[0] === "MANYVIDS_TEASER_POLL").map(row => row[1] as ReturnType<typeof teaserPollingState> & {elapsedMs:number;iteration:number});
    assert.equal(observations[0].video_preview_mp4Present, false);
    assert.equal(observations[1].video_preview_mp4Present, true);
    assert.equal(observations[1].iteration, 2);
    assert.ok(observations[1].elapsedMs >= 3000);
  } finally { console.info = info; console.warn = warn; }
});

test("teaser stops after 40 missing previews without private fallback", async () => {
  let polls = 0, creations = 0;
  const info = console.info;
  console.info = () => {};
  try {
    const client = new ManyVidsClient(structuredClone(session), async () => {}, async (value) => {
      const pathname = new URL(String(value)).pathname;
      if (pathname === "/includes/init_session.php") return Response.json({mvtoken:"fixture"});
      if (pathname === "/api/video/preview") { creations++; return Response.json({success:true}); }
      assert.equal(pathname, "/includes/get_edit_preview_vid_status.php");
      polls++;
      return Response.json({success:true,pendingVid:[{vid:"789",p:0,pr:"1",cs:"2",e:"0",video_preview_mp4:""}]});
    });
    const clock = pollingClock();
    await assert.rejects(generateTeaser(client, {bucket:"fixture",key:"123/file",etag:"fixture"}, "789", 0, clock), {code:"TEASER_NOT_CONFIRMED"});
    assert.equal(polls, 40);
    assert.equal(creations, 1);
    assert.equal(clock.now(), 39 * 3000);
  } finally {console.info = info;}
});

test("teaser preserves HTTP failures, explicit rejection and the client deadline", async () => {
  const info = console.info, warn = console.warn;
  console.info = () => {}; console.warn = () => {};
  try {
    for (const kind of ["http", "rejected", "deadline"]) {
      let polls = 0;
      const client = new ManyVidsClient(structuredClone(session), async () => {}, async value => {
        const pathname = new URL(String(value)).pathname;
        if (pathname === "/includes/init_session.php") return Response.json({mvtoken:"fixture"});
        if (pathname === "/api/video/preview") return Response.json({success:true});
        assert.equal(pathname, "/includes/get_edit_preview_vid_status.php"); polls++;
        return kind === "http" ? new Response(null,{status:403}) : Response.json({success:false,pendingVid:[{vid:789,video_preview_mp4:"/fixture"}]});
      }, kind === "deadline" ? Date.now() - 1 : Infinity);
      await assert.rejects(generateTeaser(client, {bucket:"fixture",key:"123/file",etag:"fixture"}, "789", 0, pollingClock()), {code:kind === "http" ? "SESSION_REJECTED" : kind === "deadline" ? "EXECUTION_TIMEOUT" : "REMOTE_REJECTED"});
      assert.equal(polls, kind === "deadline" ? 0 : 1);
    }
  } finally {console.info = info;console.warn = warn;}
});

const session: ManyVidsSessionData = { version: 1, creatorId: "123", cookies: [{ name: "PHPSESSID", value: "fixture-only", domain: "www.manyvids.com", hostOnly: true, path: "/" }] };
const input = publishInputSchema.parse({ publicationId: "pub", title: "Title & accents é", description: "Description", price: 12.50, tags: ["a", "b", "c"], performers: [{ mode: "account", remotePerformerId: "456", label: "Fixture" }], thumbnail: { source: "generate_from_video" }, teaser: { source: "generate_from_video", startTime: 0 }, publishMode: "NOW" });

test("upload create immediately refreshes and sends the persisted replacement access cookie", async () => {
  const source = { objectKey: "fixture", bucketName: "fixture", originalFileName: "video.mp4", contentType: "video/mp4", fileSize: 100, durationSeconds: 14, width: 1920, height: 1080 };
  const cookies: ManyVidsSessionData = { version: 1, creatorId: "1011541738", cookies: [
    { name: "mv.access-token", value: "old-fixture", domain: "manyvids.com", hostOnly: false, path: "/" },
    { name: "PHPSESSID", value: "session-fixture", domain: "manyvids.com", hostOnly: false, path: "/" },
  ] };
  const calls: string[] = [];
  let persisted: ManyVidsSessionData | undefined;
  const client = new ManyVidsClient(cookies, async (next) => {
    await Promise.resolve();
    persisted = next;
    calls.push("persist");
  }, async (value, init) => {
    const url = new URL(String(value));
    calls.push(url.pathname);
    if (url.pathname === "/auth/token/v1") return Response.json({ expiration: "2099-01-01T00:00:00Z" }, {
      headers: { "set-cookie": "mv.access-token=fresh-fixture; Domain=.manyvids.com; Path=/; Max-Age=3600; Secure; HttpOnly" },
    });
    assert.equal(url.pathname, "/uploader/create");
    assert.equal(init?.method, "POST");
    const header = new Headers(init?.headers).get("Cookie")!;
    assert.equal(header.includes("old-fixture"), false);
    assert.equal(header.split("; ").filter(c => c.startsWith("mv.access-token=")).length, 1);
    assert.ok(header.includes("mv.access-token=fresh-fixture"));
    assert.equal(persisted?.cookies.find(c => c.name === "mv.access-token")?.value, "fresh-fixture");
    assert.equal(JSON.parse(String(init?.body)).meta.user_id, 1011541738);
    // Stop before reading R2 or transferring any bytes; this is an upstream fixture error.
    return Response.json({ error: "fixture-stop-before-storage" });
  });
  await assert.rejects(uploadVideo(client, source, "1011541738"), { code: "REMOTE_REJECTED" });
  assert.deepEqual(calls, ["/auth/token/v1", "persist", "/uploader/create"]);
});

test("refresh persistence failure stops upload before create and storage access", async () => {
  let calls = 0;
  const client = new ManyVidsClient(structuredClone(session), async () => { throw new Error("fixture-persist-failed"); }, async (url) => {
    calls++;
    assert.equal(new URL(String(url)).pathname, "/auth/token/v1");
    return Response.json({}, { headers: { "set-cookie": "mv.access-token=fresh-fixture; Domain=.manyvids.com; Path=/" } });
  });
  await assert.rejects(uploadVideo(client, { objectKey: "fixture", bucketName: "fixture", originalFileName: "video.mp4", contentType: "video/mp4", fileSize: 1, durationSeconds: 14, width: 1920, height: 1080 }, "123"), /fixture-persist-failed/);
  assert.equal(calls, 1);
});

test("tag library uses the mapped read endpoint and validates selected IDs before save", async () => {
  const library = [{ id: 11, name: "Existing" }, { id: 12, name: "Second" }, { id: 13, name: "Third" }];
  const client = new ManyVidsClient(structuredClone(session), async () => {}, async (url, init) => {
    assert.equal(init?.method ?? "GET", "GET");
    assert.ok(String(url).startsWith(`${API}/tags/partial/`));
    return Response.json(library);
  });
  assert.deepEqual(await searchTags(client, "Existing"), library.map((tag) => ({ id: String(tag.id), label: tag.name })));
  const tags = library.map((tag) => ({ id: String(tag.id), label: tag.name }));
  assert.equal(publishInputSchema.safeParse({ ...input, tags }).success, true);
  assert.deepEqual(await resolveTags(client, tags), ["11", "12", "13"]);
  await assert.rejects(resolveTags(client, [{ id: "99", label: "Existing" }, ...tags.slice(1)]), { code: "TAG_NOT_RESOLVED" });
  await assert.rejects(resolveTags(client, [tags[0], tags[0], tags[1]]), { code: "AT_LEAST_THREE_DISTINCT_TAGS" });
  await assert.rejects(resolveTags(client, ["Unmapped custom tag", "Second", "Third"]), { code: "TAG_NOT_RESOLVED" });
});

test("save uses IDs, account-only consent state and HAR form values", () => {
  const fields = buildSaveFields(input, "789", ["1", "2", "3"], { kind: "account", ids: ["456"], associated: true });
  assert.equal(fields.get("co_performer"), "YES");
  assert.equal(fields.get("documentUploadStatus"), "0");
  assert.equal(fields.get("age_and_consent"), "0");
  assert.equal(fields.get("vid_token"), "false");
  assert.equal(fields.get("vid_name"), "false");
  assert.equal(fields.get("vid_price"), "12.50");
  assert.deepEqual(fields.getAll("vid_tags[]"), ["1", "2", "3"]);
  assert.equal(new URLSearchParams(fields.toString()).get("vid_title"), input.title);
  assert.throws(() => buildSaveFields(input, "789", ["text-tag"], { kind: "none" }));
  assert.throws(() => performerSaveFields({ kind: "documents_required" }));
  assert.throws(() => performerSaveFields({ kind: "account", ids: ["456"], associated: false }));
});

test("scope cookies by host/path and expire only matching cookie", () => {
  const jar = new ManyVidsCookieJar(structuredClone(session));
  assert.equal(jar.header(new URL(`${API}/uploader/create`)), "");
  assert.equal(jar.header(new URL(`${WEB}/includes/init_session.php`)), "PHPSESSID=fixture-only");
  jar.absorb(new Headers({ "set-cookie": "mv.access-token=token-fixture; Domain=.manyvids.com; Path=/; Secure" }), new URL(`${API}/auth/token/v1`));
  assert.equal(jar.header(new URL(`${API}/uploader/create`)), "mv.access-token=token-fixture");
  jar.absorb(new Headers({ "set-cookie": "mv.access-token=expired; Domain=.manyvids.com; Path=/; Max-Age=0" }), new URL(`${API}/auth/token/v1`));
  assert.equal(jar.header(new URL(`${API}/uploader/create`)), "");
  jar.absorb(new Headers({ "set-cookie": "injected=x; Domain=example.com; Path=/" }), new URL(API));
  assert.equal(jar.header(new URL("https://example.com/")), "");
});

test("hash matches exact transmitted JSON and client never follows redirects", async () => {
  let checked = false;
  const transport: typeof fetch = async (_url, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(init?.redirect, "manual");
    assert.equal(headers.get("x-amz-content-sha256"), createHash("sha256").update(String(init?.body)).digest("hex"));
    assert.equal(headers.get("cookie"), "");
    checked = true;
    return new Response(null, { status: 204 });
  };
  const client = new ManyVidsClient(structuredClone(session), async () => {}, transport);
  await client.json("/v1/store/videos/", "FINALIZE", { videoId: "789", title: "é" }, "PUT");
  assert.equal(checked, true);
  assert.equal(jsonBody({ x: "é" }).hash, createHash("sha256").update('{"x":"é"}').digest("hex"));
});

test("HTTP 200 application error and malformed required JSON fail without leaking response", async () => {
  for (const body of ['{"error":"cookie=secret"}', '<html>session-secret</html>']) {
    const client = new ManyVidsClient(structuredClone(session), async () => {}, async () => new Response(body));
    await assert.rejects(client.request(API, "/uploader/create", "UPLOAD"), (error) => !safeError(error).message.includes("secret"));
  }
  const client = new ManyVidsClient(structuredClone(session), async () => {}, async () => new Response(null, { status: 302, headers: { location: "https://other.example" } }));
  await assert.rejects(client.request(API, "/auth/token/v1", "SESSION"), { code: "SESSION_REJECTED" });
});

test("teaser accepts unknown JSON fields; form requests obtain a fresh token", async () => {
  let tokens = 0;
  const client = new ManyVidsClient(structuredClone(session), async () => {}, async (url, init) => {
    if (String(url).includes("init_session.php")) return Response.json({ mvtoken: `fixture-${++tokens}` });
    assert.equal(new URLSearchParams(String(init?.body)).get("mvtoken"), `fixture-${tokens}`);
    return Response.json({ unrecognizedProviderField: { nested: true } });
  });
  await client.form("/api/video/preview", "TEASER", new URLSearchParams({ video_id: "789" }));
  await client.form("/includes/get_edit_preview_vid_status.php", "TEASER", new URLSearchParams({ video_id: "789" }));
  assert.equal(tokens, 2);
});

test("publication confirmation requires owner, launch, title, price, co-performer and public URL", () => {
  const expected = { videoId: "789", creatorId: "123", title: input.title, price: 12.5, hasPerformer: true };
  const preview = { id: "789", creatorId: "123", title: input.title, price: 12.5, url: "https://www.manyvids.com/public-fixture" };
  const data = { publiclyLaunched: true, isPrivate: false, hasCoPerformer: true };
  assert.equal(confirmedVideo({ data }, expected, preview), preview.url);
  assert.equal(confirmedVideo({ data: { ...data, publiclyLaunched: false } }, expected, preview), null);
  assert.throws(() => confirmedVideo({ data }, expected, { ...preview, creatorId: "999" }), { code: "VIDEO_OWNER_MISMATCH" });
  assert.equal(confirmedVideo({ data }, expected, { ...preview, url: "/Edit-vid/789" }), null);
  assert.equal(confirmedVideo({ data }, expected, { ...preview, url: "https://evil.example/video" }), null);
});

test("multipart inner JSON, restricted signed hosts, unsupported modes and custom limits", () => {
  assert.deepEqual(unwrapData({ data: '{"UploadId":"abc","Key":"123/file"}' }, "UPLOAD"), { UploadId: "abc", Key: "123/file" });
  assert.throws(() => validateSignedUploadUrl("http://127.0.0.1/upload"));
  assert.throws(() => validateSignedUploadUrl("https://bucket.s3.amazonaws.com.evil.example/upload"));
  assert.throws(() => requireSupported({ ...input, publishMode: "SCHEDULED" }));
  assert.throws(() => requireSupported({ ...input, thumbnail: { source: "upload_custom", mediaAssetId: "image" } }));
  assert.equal(publishInputSchema.safeParse({ ...input, teaser: { source: "upload_custom", durationSeconds: 31, fileSize: 1000 } }).success, false);
  assert.equal(publishInputSchema.safeParse({ ...input, teaser: { source: "upload_custom", durationSeconds: 30, fileSize: 50_000_000 } }).success, false);
});

test("local contract rejects incomplete/duplicate performers and frontend consent flags", () => {
  assert.equal(publishInputSchema.safeParse({ ...input, performers: [] }).success, true);
  assert.equal(publishInputSchema.safeParse({ ...input, performers: [input.performers[0], input.performers[0]] }).success, false);
  assert.equal(publishInputSchema.safeParse({ ...input, performers: [{ mode: "documents", label: "Fixture", localPerformerId: "local" }] }).success, false);
  for (const field of ["documentUploadStatus", "co_performer", "age_and_consent"]) {
    assert.equal(publishInputSchema.safeParse({ ...input, [field]: "0" }).success, false);
  }
  assert.equal(publishInputSchema.safeParse({ ...input, thumbnail: { source: "upload_custom", filename: "unsafe" } }).success, false);
});

test("assets and documents must belong to the authorized local catalog; limits use stored metadata", () => {
  const options: LocalOptions = {
    assets: [{ id: "teaser", label: "Fixture", mediaType: "VIDEO", durationSeconds: 30, fileSize: 49_999_999 }],
    performers: [{ id: "local", label: "Fixture", documents: [{ id: "identity", label: "ID", source: "document", role: "identity" }, { id: "release", label: "Release", source: "agreement", role: "consent" }] }],
  };
  const custom = publishInputSchema.parse({ ...input, teaser: { source: "upload_custom", mediaAssetId: "teaser" } });
  assert.doesNotThrow(() => validateLocalOptions(custom, options, 120));
  for (const asset of [{ ...options.assets[0], fileSize: 50_000_000 }, { ...options.assets[0], durationSeconds: 31 }, { ...options.assets[0], durationSeconds: null }]) {
    assert.throws(() => validateLocalOptions(custom, { ...options, assets: [asset] }, 120), { code: "INVALID_CUSTOM_TEASER_LIMITS" });
  }
  assert.throws(() => validateLocalOptions(custom, { ...options, assets: [] }, 120), { code: "TEASER_ASSET_NOT_READY" });
  const documented = publishInputSchema.parse({ ...input, performers: [{ mode: "documents", localPerformerId: "local", idDocumentId: "identity", consentDocumentId: "release", consentSource: "agreement", label: "Fixture" }] });
  assert.deepEqual(validateLocalOptions(documented, options, 120), [{ kind: "documents_ready" }]);
  assert.throws(() => validateLocalOptions(documented, { ...options, performers: [] }, 120), { code: "PERFORMER_DOCUMENTS_REQUIRED" });
  assert.throws(() => requireSupported(documented), { code: "DOCUMENTS_NOT_SUPPORTED" });
  assert.throws(() => performerSaveFields({ kind: "documents_ready" }), { code: "DOCUMENTS_NOT_SUPPORTED" });
  assert.throws(() => requireSupported({ ...input, teaser: { source: "generate_from_video", startTime: 0, duration: 10 } }), { code: "TEASER_DURATION_NOT_SUPPORTED" });
  assert.throws(() => requireSupported({ ...input, thumbnail: { source: "generate_from_video", frameTime: 0 } }), { code: "THUMBNAIL_FRAME_NOT_SUPPORTED" });
});

test("account array sends all coStarIds; save fields are derived only after association", async () => {
  let calls = 0;
  const client = new ManyVidsClient(structuredClone(session), async () => {}, async (url, init) => {
    if (String(url).includes("init_session.php")) return Response.json({ mvtoken: "fixture" });
    calls++;
    assert.deepEqual((init?.body as FormData).getAll("coStarIds[]"), ["456", "457"]);
    return Response.json({ msg: "fixture" });
  });
  const state = await associatePerformer(client, "789", ["456", "457"]);
  assert.equal(calls, 1);
  assert.deepEqual(state, { kind: "account", ids: ["456", "457"], associated: true });
  assert.equal(performerSaveFields(state).co_performer, "YES");
  assert.equal(performerSaveFields(await associatePerformer(client, "789", [])).co_performer, "NO");
  assert.equal(calls, 1);
});

test("teaser completion resumes performer, save, transcode and final publication without private", async () => {
  const calls: string[] = [];
  let checkpointed = false;
  const transport: typeof fetch = async (value, init) => {
    const url = new URL(String(value));
    calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
    if (url.pathname === "/auth/token/v1") return Response.json({ expiration: "fixture" });
    if (url.pathname === "/includes/init_session.php") return Response.json({ mvtoken: "fixture-token" });
    if (url.pathname.startsWith("/tags/partial/")) {
      const name = url.pathname.split("/")[3];
      return Response.json([{ id: String(["a", "b", "c"].indexOf(name) + 1), name }]);
    }
    if (url.pathname === "/unified-media/unified-upload/v2") {
      const body = JSON.parse(String(init?.body));
      if (body.save) return Response.json({ save: { statusCode: 200, message: { video: { id: 789 } } }, stt: { statusCode: 200 } });
      assert.equal(checkpointed, true);
      return Response.json({ stt: { statusCode: 200 } });
    }
    if (url.pathname === "/unified-media/progress/v1") return new Response(null, { status: 404 });
    if (url.pathname === "/uploader/video/789/preview-details") return Response.json({ id: "789", creatorId: "123", title: input.title, price: input.price, url: `${WEB}/fixture-video` });
    if (url.pathname === "/api/video/preview" || url.pathname === "/includes/get_edit_preview_vid_status.php") return Response.json({ success: true, pendingVid: [{vid:789,video_preview_mp4: "/fixture-preview"}] });
    if (url.pathname === "/api/coperformers") {
      assert.equal((init?.body as FormData).get("coStarIds[]"), "456");
      return Response.json({ msg: "fixture-accepted" });
    }
    if (url.pathname === "/includes/saveVideo.php") {
      assert.equal(new URLSearchParams(String(init?.body)).get("co_performer"), "YES");
      return Response.json({ error: false });
    }
    if (url.pathname === "/v1/store/videos/") return Response.json({});
    if (url.pathname === "/store/video/789") return Response.json({ data: { publiclyLaunched: true, isPrivate: false, hasCoPerformer: true } });
    throw new Error("Unexpected fixture request");
  };
  const client = new ManyVidsClient(structuredClone(session), async () => {}, transport);
  const result = await publishManyVids(input, { objectKey: "fixture", bucketName: "fixture", originalFileName: "video.mp4", contentType: "video/mp4", fileSize: 1, durationSeconds: 60, width: 1920, height: 1080 }, "123", client, async (value) => { assert.equal(value, "789"); checkpointed = true; }, async () => ({ bucket: "manyvids-input", key: "123/file.mp4", etag: "fixture-etag" }));
  assert.equal(result.externalPostId, "789");
  assert.equal(checkpointed, true);
  assert.equal(calls.some((call) => call.includes("/unified-media/progress/")), false);
  assert.equal(calls.some(call => call.includes("/private")), false);
  assert.ok(calls.indexOf("POST /api/coperformers") > calls.indexOf("POST /includes/get_edit_preview_vid_status.php"));
  assert.ok(calls.indexOf("POST /includes/saveVideo.php") > calls.indexOf("POST /api/coperformers"));
  assert.ok(calls.indexOf("PUT /v1/store/videos/") > calls.indexOf("POST /includes/saveVideo.php"));
});

const expectedFinal = { videoId: "789", creatorId: "123", title: input.title, price: input.price, hasPerformer: true };
const finalPreview = { id: "789", creatorId: "123", title: input.title, price: input.price, url: `${WEB}/fixture-video` };
function pollingClock() {
  let elapsed = 0;
  return { now: () => elapsed, sleep: async (ms: number) => { elapsed += ms; } };
}

test("final rereads allow delayed launch, privacy, metadata and co-performer propagation", async () => {
  const clock = pollingClock();
  let reads = 0;
  const client = new ManyVidsClient(structuredClone(session), async () => {}, async (url, init) => {
    assert.equal(init?.method ?? "GET", "GET");
    if (String(url).includes("preview-details")) {
      reads++;
      return Response.json(reads === 1 ? { id: "789", creatorId: "123" } : finalPreview);
    }
    return Response.json({ data: reads >= 4 ? { publiclyLaunched: true, isPrivate: false, hasCoPerformer: true } : { publiclyLaunched: false, isPrivate: true } });
  });
  const result = await confirmPublication(client, expectedFinal, clock);
  assert.equal(result.externalPostId, "789");
  assert.equal(reads, 4);
  assert.equal(clock.now(), 15_000);
});

test("final incorrect ID or creator fails immediately without more polling", async () => {
  for (const details of [{ ...finalPreview, id: "999" }, { ...finalPreview, creatorId: "999" }]) {
    let calls = 0;
    const clock = pollingClock();
    const client = new ManyVidsClient(structuredClone(session), async () => {}, async () => { calls++; return Response.json(details); });
    await assert.rejects(confirmPublication(client, expectedFinal, clock), { code: "VIDEO_OWNER_MISMATCH" });
    assert.equal(calls, 1);
    assert.equal(clock.now(), 0);
  }
});

test("final explicit errors, including nested data errors, fail without polling", async () => {
  for (const body of [{ error: "fixture failure" }, { data: { error: "fixture failure" } }]) {
    const clock = pollingClock();
    const client = new ManyVidsClient(structuredClone(session), async () => {}, async (url) =>
      Response.json(String(url).includes("preview-details") ? finalPreview : body));
    await assert.rejects(confirmPublication(client, expectedFinal, clock), { code: "REMOTE_REJECTED" });
    assert.equal(clock.now(), 0);
  }
});

test("final timeout is specific and only rereads the existing video for five minutes", async () => {
  const clock = pollingClock();
  let reads = 0;
  const client = new ManyVidsClient(structuredClone(session), async () => {}, async (url, init) => {
    assert.equal(init?.method ?? "GET", "GET");
    assert.ok(String(url).includes("/789"));
    assert.ok(!String(url).includes("uploader/create"));
    reads++;
    return Response.json(String(url).includes("preview-details") ? finalPreview : { data: { publiclyLaunched: false, isPrivate: true } });
  });
  await assert.rejects(confirmPublication(client, expectedFinal, clock), { code: "REMOTE_CONFIRMATION_TIMEOUT", stage: "CONFIRM" });
  assert.equal(clock.now(), 300_000);
  assert.equal(reads, 120);
});
