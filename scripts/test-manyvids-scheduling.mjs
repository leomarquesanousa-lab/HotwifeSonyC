// Local isolated tests. No real database, credentials, uploads or publication.
import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = `
export const state = {tables:{},calls:0,error:null,gate:null,lastInput:null};
let queue=Promise.resolve();let serial=0;
const rows=n=>state.tables[n]??=[];
function query(name,filters=[],limit=Infinity){const matching=()=>rows(name).filter(r=>filters.every(f=>f(r))).slice(0,limit);return {
where(c){const f=typeof c==='function'?row=>c(new Proxy({},{get:(_,k)=>({gt:v=>row[k]>v,gte:v=>row[k]>=v,lt:v=>row[k]<v,lte:v=>row[k]<=v,neq:v=>row[k]!==v})})):row=>Object.entries(c).every(([k,v])=>row[k]===v);return query(name,[...filters,f],limit)},
select(){return this},orderBy(){return this},limit(n){return query(name,filters,n)},
async all(){return structuredClone(matching())},async first(){return structuredClone(matching()[0]??null)},
async update(v){const r=matching()[0];if(!r)throw Error('No row');Object.assign(r,v);return structuredClone(r)},
async updateAndCount(v){const list=matching();list.forEach(r=>Object.assign(r,v));return list.length},
async create(v){const r={id:'fixture-'+(++serial),externalPostId:null,startedAt:null,scheduledAt:null,attemptCount:0,createdAt:new Date().toISOString(),...v};rows(name).push(r);return structuredClone(r)}
}}
export const db={orm:{public:new Proxy({},{get:(_,n)=>query(n)})},async transaction(fn){let release;const prev=queue;queue=new Promise(r=>release=r);await prev;const before=structuredClone(state.tables);try{return await fn({orm:db.orm})}catch(e){state.tables=before;throw e}finally{release()}}};
export function decryptManyVidsSession(){return {version:1,creatorId:'123',cookies:[]}}
export function encryptManyVidsSession(){return 'fixture-encrypted'}
export async function publishManyVids(input,source,creator,client,persist){state.calls++;state.lastInput=input;await persist('remote-fixture');if(state.gate)await state.gate;if(state.error)throw state.error;return {externalPostId:'remote-fixture',externalPostUrl:'https://www.manyvids.com/fixture'}};
`;
const result = await build({
  stdin: {
    resolveDir: root,
    contents: `export * from './src/lib/distribution/manyvids-scheduling';export * from './src/lib/distribution/execute-manyvids';export * from './src/lib/distribution/schedule-time';export * from './src/lib/platforms/manyvids/http/teaser-validation';export {ManyVidsError} from './src/lib/platforms/manyvids/http/types';export {state} from 'schedule-fixture';`,
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  write: false,
  logLevel: "silent",
  plugins: [
    {
      name: "isolate",
      setup(b) {
        b.onResolve(
          {
            filter:
              /(?:prisma\/db$|manyvids\/http\/(?:publish|session)$|^schedule-fixture$)/,
          },
          () => ({ path: "fixture", namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: fixture,
          loader: "js",
        }));
      },
    },
  ],
});
const loadedModule = new Module(
  path.join(root, "scripts/scheduling-tests.memory.cjs"),
);
loadedModule.filename = path.join(root, "scripts/scheduling-tests.memory.cjs");
loadedModule.paths = Module._nodeModulePaths(root);
loadedModule._compile(result.outputFiles[0].text, loadedModule.filename);
const a = loadedModule.exports;
const originalFetch = globalThis.fetch,
  originalError = console.error;
globalThis.fetch = async () => {
  throw Error("Network forbidden in scheduling tests");
};
console.error = () => {};
const input = {
  publicationId: "p",
  title: "Fixture",
  description: "Fixture description",
  price: 10,
  tags: ["a", "b", "c"],
  performers: [],
  thumbnail: { source: "generate_from_video" },
  teaser: { source: "generate_from_video", startTime: 10 },
  publishMode: "NOW",
};
function seed() {
  a.state.calls = 0;
  a.state.error = null;
  a.state.gate = null;
  a.state.tables = {
    Workspace: [{ id: "w", status: "ACTIVE" }],
    Creator: [{ id: "c", workspaceId: "w", status: "ACTIVE" }],
    PlatformAccount: [
      {
        id: "a",
        creatorId: "c",
        workspaceId: "w",
        platform: "MANYVIDS",
        status: "CONNECTED",
        lastVerifiedAt: null,
      },
    ],
    MediaAsset: [
      {
        id: "m",
        workspaceId: "w",
        creatorId: "c",
        status: "UPLOADED",
        mediaType: "VIDEO",
        storageProvider: "R2",
        durationSeconds: 14,
        width: 1080,
        height: 1920,
        fileSize: 100n,
        objectKey: "fixture",
        bucketName: "fixture",
        originalFileName: "fixture.mp4",
        contentType: "video/mp4",
      },
    ],
  };
}
async function schedule() {
  return a.createManyVidsSchedule({
    userId: "u",
    workspaceId: "w",
    mediaId: "m",
    accountId: "a",
    scheduledAt: new Date(Date.now() + 60000).toISOString(),
    timeZone: "America/Los_Angeles",
    options: input,
  });
}
function due() {
  const at = new Date(Date.now() - 60000).toISOString();
  a.state.tables.PlatformPublication[0].scheduledAt = at;
  a.state.tables.DistributionJob[0].scheduledAt = at;
}
let count = 0;
async function test(name, run) {
  seed();
  await run();
  count++;
  process.stdout.write(`OK: ${name}\n`);
}
try {
  await test("10 segundos em vídeo de 14; ausência de duração tem erro distinto", () => {
    assert.equal(a.teaserStartIssue(10, 14), "");
    assert.equal(a.teaserStartIssue(0, 14), "");
    assert.equal(a.teaserStartIssue(14, 14), "invalidTeaserStart");
    assert.equal(a.teaserStartIssue(10, null), "olderVideoNeedsMetadata");
    assert.equal(a.teaserStartIssue(-1, 14), "invalidTeaserStart");
  });
  await test("conversão UTC, horário de verão, horário inexistente e ambíguo", () => {
    assert.equal(
      a.scheduledUtc("2027-01-15T10:00", "America/Los_Angeles", 0),
      "2027-01-15T18:00:00.000Z",
    );
    assert.equal(
      a.scheduledUtc("2027-07-15T10:00", "America/Los_Angeles", 0),
      "2027-07-15T17:00:00.000Z",
    );
    assert.equal(
      a.scheduledUtc("2027-01-15T10:00", "Asia/Kolkata", 0),
      "2027-01-15T04:30:00.000Z",
    );
    assert.throws(
      () => a.scheduledUtc("2027-03-14T02:30", "America/Los_Angeles", 0),
      /SCHEDULE_INVALID/,
    );
    assert.throws(
      () => a.scheduledUtc("2027-11-07T01:30", "America/Los_Angeles", 0),
      /SCHEDULE_AMBIGUOUS/,
    );
    assert.throws(
      () => a.scheduledUtc("2027-02-30T10:00", "UTC", 0),
      /SCHEDULE_INVALID/,
    );
    assert.throws(
      () => a.scheduledUtc("2000-01-01T00:00", "UTC"),
      /SCHEDULE_IN_PAST/,
    );
  });
  await test("agendar persiste snapshot e não executa ManyVids", async () => {
    const r = await schedule();
    assert.equal(r.publications[0].status, "SCHEDULED");
    const p = a.state.tables.PlatformPublication[0];
    assert.equal(p.publishingOptions.input.teaser.startTime, 10);
    assert.equal(p.publishingOptions.input.publishMode, "NOW");
    assert.equal(p.attemptCount, 0);
    assert.equal(a.state.calls, 0);
    await a.runDueManyVidsPublications();
    assert.equal(a.state.calls, 0);
  });
  await test("metadados ausentes impedem agendamento sem criar registros", async () => {
    a.state.tables.MediaAsset[0].durationSeconds = null;
    await assert.rejects(schedule(), { code: "VIDEO_METADATA_REQUIRED" });
    assert.equal(a.state.tables.PlatformPublication?.length ?? 0, 0);
  });
  await test("Cron usa executor existente uma única vez e agrega status", async () => {
    await schedule();
    due();
    await a.runDueManyVidsPublications();
    const p = a.state.tables.PlatformPublication[0];
    assert.equal(a.state.calls, 1);
    assert.equal(p.status, "PUBLISHED");
    assert.equal(p.attemptCount, 1);
    assert.equal(p.externalPostId, "remote-fixture");
    assert.equal(a.state.tables.DistributionJob[0].status, "COMPLETED");
    await a.runDueManyVidsPublications();
    assert.equal(a.state.calls, 1);
  });
  await test("disparos concorrentes não duplicam publicação", async () => {
    await schedule();
    due();
    await Promise.all([
      a.runDueManyVidsPublications(),
      a.runDueManyVidsPublications(),
    ]);
    assert.equal(a.state.calls, 1);
    assert.equal(a.state.tables.PlatformPublication[0].status, "PUBLISHED");
  });
  await test("tentativa antecipada e chamada manual não burlam agendamento", async () => {
    await schedule();
    const p = a.state.tables.PlatformPublication[0];
    assert.equal(
      (await a.executeManyVidsPublication(p.publishingOptions.input, true))
        .status,
      409,
    );
    assert.equal(
      (await a.executeManyVidsPublication(p.publishingOptions.input, false))
        .status,
      409,
    );
    assert.equal(a.state.calls, 0);
  });
  await test("conta ocupada adia sem consumir tentativa", async () => {
    await schedule();
    due();
    a.state.tables.PlatformPublication.push({
      id: "running",
      platformAccountId: "a",
      platform: "MANYVIDS",
      status: "PROCESSING",
      attemptCount: 1,
    });
    await a.runDueManyVidsPublications();
    assert.equal(a.state.tables.PlatformPublication[0].status, "SCHEDULED");
    assert.equal(a.state.tables.PlatformPublication[0].attemptCount, 0);
    assert.equal(a.state.calls, 0);
  });
  await test("falha preserva ID remoto e não faz retry cego", async () => {
    await schedule();
    due();
    a.state.error = new a.ManyVidsError(
      "REMOTE_CONFIRMATION_TIMEOUT",
      "CONFIRM",
    );
    await a.runDueManyVidsPublications();
    const p = a.state.tables.PlatformPublication[0];
    assert.equal(p.status, "FAILED");
    assert.equal(p.externalPostId, "remote-fixture");
    assert.equal(p.lastErrorCode, "REMOTE_CONFIRMATION_TIMEOUT");
    await a.runDueManyVidsPublications();
    assert.equal(a.state.calls, 1);
  });
  await test("snapshot ausente e conta desconectada falham com código", async () => {
    await schedule();
    due();
    a.state.tables.PlatformPublication[0].publishingOptions = null;
    await a.runDueManyVidsPublications();
    assert.equal(
      a.state.tables.PlatformPublication[0].lastErrorCode,
      "SCHEDULE_OPTIONS_MISSING",
    );
    assert.equal(a.state.calls, 0);
    seed();
    await schedule();
    due();
    a.state.tables.PlatformAccount[0].status = "DISCONNECTED";
    await a.runDueManyVidsPublications();
    assert.equal(a.state.tables.PlatformPublication[0].status, "FAILED");
    assert.equal(
      a.state.tables.PlatformPublication[0].lastErrorCode,
      "ACCOUNT_NOT_CONNECTED",
    );
  });
  await test("execução interrompida exige revisão sem reupload", async () => {
    await schedule();
    due();
    const p = a.state.tables.PlatformPublication[0];
    Object.assign(p, {
      status: "PUBLISHING",
      startedAt: new Date(Date.now() - 21 * 60000).toISOString(),
      attemptCount: 1,
      externalPostId: "remote-existing",
    });
    await a.runDueManyVidsPublications();
    assert.equal(p.status, "FAILED");
    assert.equal(p.lastErrorCode, "REMOTE_EXECUTION_INTERRUPTED");
    assert.equal(p.externalPostId, "remote-existing");
    assert.equal(a.state.calls, 0);
  });
  process.stdout.write(
    `${count} testes de agendamento aprovados, sem chamadas externas.\n`,
  );
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
}
