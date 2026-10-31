// Real handler and authorization, in-memory DB and R2 spy. No .env or external network.
import assert from 'node:assert/strict';
import Module from 'node:module';
import { build } from 'esbuild';
import { fixture } from './fixtures/store-db.mjs';
const root = process.cwd();
const result = await build({ stdin: { resolveDir: root, contents: `export {DELETE} from './app/api/media/[id]/route';export {state} from 'fixture';export {storage} from 'storage-fixture';` }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, plugins: [{ name: 'isolated', setup(b) {
  b.onResolve({ filter: /(?:prisma\/db$|auth\/session$|^\.\/session$|^fixture$|^server-only$)/ }, a => ({ path: a.path === 'server-only' ? 'empty' : 'db', namespace: 'fixture' }));
  b.onResolve({ filter: /storage\/r2$|^storage-fixture$/ }, () => ({ path: 'storage', namespace: 'fixture' }));
  b.onResolve({ filter: /dotenv/ }, () => { throw Error('Production environment forbidden'); });
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path === 'empty' ? '' : a.path === 'db' ? fixture.replace('async delete(){', "async delete(){if(state.failTable===name)throw Error('fixture FK failure');") : `import {state} from 'fixture';export const storage={calls:[],fail:false};export function getR2Client(){return {async send(command){if(state.tables.MediaAsset.length)throw Error('Storage deletion before DB commit');storage.calls.push(command.input);if(storage.fail)throw Error('Synthetic storage failure');}}}`, loader: 'js' }));
} }] });
const mod = new Module(root + '/scripts/media-delete.memory.cjs'); mod.filename = mod.id; mod.paths = Module._nodeModulePaths(root); mod._compile(result.outputFiles[0].text, mod.filename);
const { DELETE, state, storage } = mod.exports;
const id = '77777777-7777-4777-8777-777777777777';
function reset(role = 'OWNER') {
  state.userId = 'user'; state.failTable = null; storage.calls = []; storage.fail = false;
  state.tables = { Workspace: [{ id: 'workspace', status: 'ACTIVE' }], WorkspaceMember: [{ userId: 'user', workspaceId: 'workspace', role }], MediaAsset: [{ id, workspaceId: 'workspace', status: 'UPLOADED', mediaType: 'VIDEO', objectKey: 'synthetic/full.mp4', thumbnailObjectKey: 'synthetic/cover.jpg', bucketName: 'test' }], MediaAssetCategory: [{ id: 'category-link', mediaAssetId: id }], MediaAssetPerformer: [{ id: 'person-link', mediaAssetId: id }], VideoProduct: [], DistributionJob: [], AuditLog: [] };
}
const invoke = (body = { confirmed: true }, origin = 'https://example.test') => DELETE(new Request('https://example.test/api/media/' + id, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
process.env.NODE_ENV = 'test';
for (const [role, expected] of [['OWNER', 200], ['ADMIN', 200], ['OPERATOR', 403], ['MEMBER', 403]]) { reset(role); assert.equal((await invoke()).status, expected); if (expected !== 200) assert.equal(storage.calls.length, 0); }
reset(); state.userId = null; assert.equal((await invoke()).status, 401);
reset(); state.tables.Workspace[0].status = 'INACTIVE'; assert.equal((await invoke()).status, 403);
reset(); state.tables.MediaAsset[0].workspaceId = 'foreign'; assert.equal((await invoke()).status, 404);
for (const body of [{}, { confirmed: false }, { confirmed: true, extra: 1 }]) { reset(); assert.equal((await invoke(body)).status, 400); assert.equal(storage.calls.length, 0); }
reset(); assert.equal((await invoke({ confirmed: true }, 'https://evil.test')).status, 403);
for (const field of ['mediaAssetId', 'teaserMediaAssetId', 'thumbnailMediaAssetId']) { reset(); state.tables.VideoProduct.push({ [field]: id }); assert.equal((await invoke()).status, 409); assert.equal(storage.calls.length, 0); }
reset(); state.tables.DistributionJob.push({ mediaAssetId: id }); assert.equal((await invoke()).status, 409);
reset(); state.tables.MediaAsset[0].folderId = 'protected'; assert.equal((await invoke()).status, 409);
reset(); state.tables.PerformerDocument = [{ objectKey: 'synthetic/cover.jpg' }]; assert.equal((await invoke()).status, 409); assert.equal(storage.calls.length, 0);
reset(); state.tables.MediaAsset[0].status = 'UPLOADING'; assert.equal((await invoke()).status, 409);
reset(); state.tables.MediaAsset.push({ id: 'other', objectKey: 'synthetic/cover.jpg' }); assert.equal((await invoke()).status, 409);
for (const table of ['MediaAssetCategory', 'MediaAssetPerformer', 'MediaAsset', 'AuditLog']) {
  reset(); const before = structuredClone(state.tables); state.failTable = table; assert.equal((await invoke()).status, 500); assert.deepEqual(state.tables, before); assert.equal(storage.calls.length, 0);
}
reset(); let response = await invoke(); assert.equal(response.status, 200); assert.equal((await response.json()).deletedFromStorage, true); assert.equal(storage.calls.length, 2); assert.equal(state.tables.MediaAsset.length, 0); assert.equal(state.tables.MediaAssetCategory.length, 0); assert.equal(state.tables.MediaAssetPerformer.length, 0); assert.equal(state.tables.AuditLog[0].metadata.storageCleanup, 'COMPLETED'); assert.match(response.headers.get('cache-control'), /no-store/);
reset(); storage.fail = true; response = await invoke(); const data = await response.json(); assert.equal(response.status, 200); assert.equal(data.storageCleanupPending, true); assert.equal(state.tables.MediaAsset.length, 0); assert.equal(state.tables.AuditLog[0].metadata.storageCleanup, 'PENDING'); assert(!JSON.stringify(data).includes('synthetic/'));
reset(); const concurrent = await Promise.all([invoke(), invoke()]); assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 404]); assert.equal(state.tables.AuditLog.length, 1);
console.log('PASS: media deletion authorization, confirmation/origin/tenant, protected references, categories/participants, FK/audit rollback before R2, success, durable R2 failure receipt and concurrency. Synthetic fixtures only.');
