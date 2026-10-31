// Actual upload handlers with synthetic metadata, in-memory DB and storage spies.
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import Module from 'node:module';
import { build } from 'esbuild';
import { fixture } from './fixtures/store-db.mjs';
const root = process.cwd();
const result = await build({ stdin: { resolveDir: root, contents: `export {GET as list} from './app/api/media/route';export {POST as start} from './app/api/media/multipart/start/route';export {POST as complete} from './app/api/media/multipart/complete/route';export {POST as part} from './app/api/media/multipart/part-url/route';export {POST as abort} from './app/api/media/multipart/abort/route';export {POST as single} from './app/api/media/upload-url/route';export {state} from 'fixture';export {storage} from 'storage-fixture';` }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, plugins: [{ name: 'isolated', setup(b) {
  b.onResolve({ filter: /(?:prisma\/db$|auth\/session$|^\.\/session$|^fixture$|^server-only$)/ }, a => ({ path: a.path === 'server-only' ? 'empty' : 'db', namespace: 'fixture' }));
  b.onResolve({ filter: /storage\/r2$|^storage-fixture$/ }, () => ({ path: 'storage', namespace: 'fixture' }));
  b.onResolve({ filter: /^@aws-sdk\/s3-request-presigner$/ }, () => ({ path: 'signer', namespace: 'fixture' }));
  b.onResolve({ filter: /dotenv/ }, () => { throw Error('Live dependency forbidden'); });
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path === 'empty' ? '' : a.path === 'db' ? fixture.replace('async updateAndCount(values){', 'async update(values){return this.updateAndCount(values);},async updateAndCount(values){') : a.path === 'signer' ? `export async function getSignedUrl(){return 'https://synthetic.invalid/upload';}` : `export const storage={calls:[],size:100};export const getR2BucketName=()=> 'test';export const getR2Client=()=>({async send(c){storage.calls.push(c.constructor.name);return c.constructor.name==='HeadObjectCommand'?{ContentLength:storage.size}:{UploadId:'synthetic-upload',ETag:'synthetic-etag'};}});`, loader: 'js' }));
} }] });
const mod = new Module(root + '/scripts/upload.memory.cjs'); mod.filename = mod.id; mod.paths = Module._nodeModulePaths(root); mod._compile(result.outputFiles[0].text, mod.filename); const api = mod.exports;
function reset(role = 'OWNER') { api.state.userId = 'user'; api.storage.calls = []; api.storage.size = 100; api.state.tables = { Workspace: [{ id: 'workspace', status: 'ACTIVE' }], WorkspaceMember: [{ userId: 'user', workspaceId: 'workspace', role }], Creator: [{ id: 'creator', workspaceId: 'workspace', status: 'ACTIVE' }], MediaAsset: [] }; }
const metadata = { durationSeconds: 60, width: 1920, height: 1080 };
const input = { fileName: 'synthetic.mp4', contentType: 'video/mp4', fileSize: 100, videoMetadata: metadata, source: 'STORE_PRODUCT' };
const request = (body, origin = 'https://example.test', type = 'application/json') => new Request('https://example.test/api/media', { method: 'POST', headers: { Origin: origin, 'Content-Type': type }, body: JSON.stringify(body) });
process.env.NODE_ENV = 'test';
for (const role of ['OWNER', 'ADMIN', 'OPERATOR']) { reset(role); assert.equal((await api.start(request(input))).status, 200); }
for(const role of ['OWNER','ADMIN','OPERATOR','MEMBER']){reset(role);const res=await api.list(new NextRequest('https://example.test/api/media'));assert.equal(res.status,role==='MEMBER'?403:200);if(res.ok)assert.equal((await res.json()).canDelete,['OWNER','ADMIN'].includes(role));}
const bodies = { start: input, single: input, part: { mediaId: 'test', uploadId: 'synthetic-upload', partNumber: 1 }, abort: { mediaId: 'test', uploadId: 'synthetic-upload' }, complete: { mediaId: 'test', uploadId: 'synthetic-upload', parts: [{ partNumber: 1, etag: 'synthetic' }], videoMetadata: metadata } };
for (const [handler, body] of Object.entries(bodies)) {
  reset('MEMBER'); assert.equal((await api[handler](request(body))).status, 403, handler); assert.equal(api.storage.calls.length, 0);
  reset(); api.state.tables.Workspace[0].status = 'INACTIVE'; assert.equal((await api[handler](request(body))).status, 403, handler);
  reset(); assert.equal((await api[handler](request(body, 'https://evil.test'))).status, 403); assert.equal((await api[handler](request(body, 'https://example.test', 'text/plain'))).status, 415); assert.equal(api.storage.calls.length, 0);
}
reset(); let response = await api.start(request(input)); const created = await response.json(); assert.equal(api.state.tables.MediaAsset[0].status, 'UPLOADING');
const completion = { ...bodies.complete, mediaId: created.mediaId };
api.storage.size = 99; assert.equal((await api.complete(request(completion))).status, 409); assert.equal(api.state.tables.MediaAsset[0].status, 'UPLOADING');
api.storage.size = 100; response = await api.complete(request(completion)); assert.equal(response.status, 200); assert.equal(api.state.tables.MediaAsset[0].status, 'UPLOADED'); assert.equal(api.state.tables.MediaAsset[0].durationSeconds, 60);
reset(); assert.equal((await api.start(request({ ...input, videoMetadata: null }))).status, 400); assert.equal(api.storage.calls.length, 0);
console.log('PASS: real upload handlers enforce roles, active workspace, origin/JSON; synthetic multipart start/complete, size mismatch, metadata and readiness. R2 commands/signatures mocked.');
