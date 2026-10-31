// Product-scoped participants and automatic reuse, with real services and isolated fixtures.
import assert from 'node:assert/strict';
import Module from 'node:module';
import { build } from 'esbuild';
import { fixture } from './fixtures/store-db.mjs';
const root = process.cwd();
const bundle = await build({ stdin: { resolveDir: root, contents: `export {saveStoreProduct,listStoreProducts} from './src/lib/store/admin';export {getPublishedVideos,resolvePublicMedia} from './src/lib/store/public';export {requirePurchasedVideo} from './src/lib/store/purchases';export {state} from 'fixture';` }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, plugins: [{ name: 'isolate', setup(b) {
  b.onResolve({ filter: /(?:prisma\/db$|auth\/session$|^\.\/session$|^fixture$|^server-only$)/ }, a => ({ path: a.path === 'server-only' ? 'empty' : 'db', namespace: 'fixture' }));
  b.onResolve({ filter: /dotenv|storage\/r2/ }, () => { throw Error('Live services forbidden'); });
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path === 'empty' ? '' : fixture, loader: 'js' }));
} }] });
const mod = new Module(root + '/scripts/simplified.memory.cjs'); mod.filename = mod.id; mod.paths = Module._nodeModulePaths(root); mod._compile(bundle.outputFiles[0].text, mod.filename); const a = mod.exports;
const id = n => `99999999-9999-4999-8999-${String(n).padStart(12, '0')}`;
const workspace = id(1), owner = id(2), person = id(3), second = id(4), full = id(5), teaser = id(6), cover = id(7), customer = id(8);
a.state.userId = owner;
a.state.tables = { Workspace: [{ id: workspace, status: 'ACTIVE' }], WorkspaceMember: [{ userId: owner, workspaceId: workspace, role: 'OWNER' }], User: [{ id: owner, status: 'ACTIVE' }, { id: customer, status: 'ACTIVE' }], Performer: [person, second].map((id, i) => ({ id, workspaceId: workspace, status: 'ACTIVE', displayName: 'Synthetic participant ' + i })), ComplianceIdentity: [['USER', owner], ['PERFORMER', person], ['PERFORMER', second]].map(([subjectType, subjectId]) => ({ workspaceId: workspace, subjectType, subjectId, status: 'VERIFIED', dateOfBirth: '1990-01-01', evidenceRef: 'test-vault:identity', createdAt: '2025-01-01' })), MediaAsset: [full, teaser, cover].map((id, i) => ({ id, workspaceId: workspace, status: 'UPLOADED', mediaType: i === 2 ? 'IMAGE' : 'VIDEO', contentType: i === 2 ? 'image/jpeg' : 'video/mp4', durationSeconds: 60, objectKey: 'synthetic/' + i })), MediaAssetPerformer: [], VideoProduct: [], ContentConsent: [], ContentReview: [], ComplianceNote: [], AuditLog: [], Purchase: [] };
const input = { title: 'Synthetic video', description: 'Synthetic only', slug: 'synthetic', category: 'Original', priceCents: 1234, currency: 'USD', featured: false, status: 'DRAFT', creatorId: person, participantIds: [person], mediaAssetId: full, teaserMediaAssetId: teaser, thumbnailMediaAssetId: cover };
const evidence = { attest: true, recordedOn: '2025-01-01', consents: [{ performerId: person, evidenceRef: 'test-vault:content-specific' }] };
const mediaBefore = structuredClone(a.state.tables.MediaAsset), linksBefore = structuredClone(a.state.tables.MediaAssetPerformer), identitiesBefore = structuredClone(a.state.tables.ComplianceIdentity);
let product = await a.saveStoreProduct(workspace, input); assert.deepEqual(product.participantIds, [person]);
await assert.rejects(() => a.saveStoreProduct(workspace, { ...input, status: 'PUBLISHED' }, product.id), /Publication pending/);
product = await a.saveStoreProduct(workspace, { ...input, status: 'PUBLISHED', ownerPublication: evidence }, product.id);
assert.deepEqual(product.knownParticipantIds, [person]);
assert.equal(product.status, 'PUBLISHED'); const review = structuredClone(a.state.tables.ContentReview), consent = structuredClone(a.state.tables.ContentConsent);
await a.saveStoreProduct(workspace, { ...input, title: 'Edited metadata' }, product.id);
await a.saveStoreProduct(workspace, { ...input, title: 'Edited metadata', status: 'PUBLISHED' }, product.id);
assert.equal(a.state.tables.ContentReview.length, review.length); assert.deepEqual(a.state.tables.ContentConsent, consent);
assert.equal((await a.getPublishedVideos())[0].priceCents, 1234);
a.state.userId = customer; await assert.rejects(() => a.requirePurchasedVideo(product.id), e => e.status === 403); a.state.userId = owner;
for (const [field, message] of [['thumbnailMediaAssetId', /Cover not uploaded/], ['teaserMediaAssetId', /Teaser not uploaded/]]) {
  const draft = await a.saveStoreProduct(workspace, { ...input, slug: 'missing-' + field.toLowerCase(), [field]: null });
  await assert.rejects(() => a.saveStoreProduct(workspace, { ...input, slug: draft.slug, [field]: null, status: 'PUBLISHED' }, draft.id), message);
}
await assert.rejects(() => a.saveStoreProduct(workspace, { ...input, participantIds: [id(99)] }, product.id), /active participants/);
await a.saveStoreProduct(workspace, { ...input, participantIds: [person, second] }, product.id);
assert.equal(a.state.tables.VideoProduct.find(p => p.id === product.id).complianceStatus, 'DRAFT');
await assert.rejects(() => a.saveStoreProduct(workspace, { ...input, participantIds: [person, second], status: 'PUBLISHED' }, product.id), /content-specific consent/);
assert.deepEqual(a.state.tables.ContentConsent, consent);
assert.deepEqual(a.state.tables.MediaAsset, mediaBefore); assert.deepEqual(a.state.tables.MediaAssetPerformer, linksBefore); assert.deepEqual(a.state.tables.ComplianceIdentity, identitiesBefore);
assert.deepEqual((await a.listStoreProducts(workspace)).find(p => p.id === product.id).participantIds, [person, second]);
assert.equal(await a.resolvePublicMedia('synthetic', 'full'), null);
console.log('PASS: participant selection persists per product without changing shared media/identities/consent; completed review reused without extra approval; missing cover/teaser/consent and unknown participants blocked; catalog price and unpaid access protected.');
