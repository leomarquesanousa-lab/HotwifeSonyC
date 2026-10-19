import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { fixture } from './fixtures/store-db.mjs';

// Execute only this flow in memory: no app build, .env, database or storage access.
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function execute(source, filename, resolve) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(resolve, module, module.exports);
  return module.exports;
}
const memory = execute(fixture, 'fixture.ts', nativeRequire);
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename);
  const exports = execute(fs.readFileSync(filename, 'utf8'), filename, specifier => {
    if (specifier === 'server-only') return {};
    if (specifier === '@/src/prisma/db') return memory;
    if (specifier === '@/src/lib/auth/session') return memory;
    if (specifier.includes('/auth/') && !specifier.endsWith('/request')) return {};
    if (specifier === 'next/server') return nativeRequire(specifier);
    if (specifier.startsWith('node:') || specifier === 'zod') return nativeRequire(specifier);
    const resolved = specifier.startsWith('@/') ? specifier.slice(2) : path.resolve(path.dirname(filename), specifier);
    return load(resolved + '.ts');
  });
  cache.set(filename, exports);
  return exports;
}
const service = load('src/lib/compliance/service.ts');
const fields = load('src/lib/store/product-fields.ts');
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const workspaceId = id(1), actorId = id(2), performerId = id(3);
const product = { id: id(4), workspaceId, mediaAssetId: id(5), teaserMediaAssetId: null, thumbnailMediaAssetId: null, title: 'Video', slug: 'video', description: 'Description', category: 'Video', complianceStatus: 'DRAFT' };
const { state, db } = memory;
Object.assign(state.tables, {
  VideoProduct: [product], User: [{ id: actorId, status: 'ACTIVE' }],
  WorkspaceMember: [{ workspaceId, userId: actorId, role: 'OWNER' }],
  Performer: [{ id: performerId, workspaceId, status: 'ACTIVE', displayName: 'Participant' }],
  MediaAssetPerformer: [{ workspaceId, mediaAssetId: product.mediaAssetId, performerId }],
});
const context = input => db.transaction(tx => service.ownerPublicationContext(tx, workspaceId, actorId, input ?? state.tables.VideoProduct[0]));
assert.match((await context()).pending.join(' '), /Creator/);
const identity = { workspaceId, status: 'VERIFIED', dateOfBirth: '1990-01-01', evidenceRef: 'vault:verified-id', expiresAt: null, createdAt: '2026-01-01' };
state.tables.ComplianceIdentity = [{ ...identity, subjectType: 'USER', subjectId: actorId }, { ...identity, subjectType: 'PERFORMER', subjectId: performerId }];
assert.deepEqual((await context()).missingConsentIds, [performerId]);
await assert.rejects(() => db.transaction(tx => service.completeOwnerPublication(tx, workspaceId, actorId, product)), /pending content review/);
const evidence = { recordedOn: '2026-01-01', attest: true, consents: [{ performerId, evidenceRef: 'vault:content-release-2257' }] };
await db.transaction(tx => service.completeOwnerPublication(tx, workspaceId, actorId, state.tables.VideoProduct[0], evidence));
let ready = await context();
assert.equal(ready.needsAttestation, false);
assert.equal(ready.recordedOn, evidence.recordedOn);
assert.deepEqual(ready.pending, []);
assert.deepEqual(ready.missingConsentIds, []);
const counts = [state.tables.ComplianceIdentity.length, state.tables.ContentConsent.length];
await db.transaction(tx => service.completeOwnerPublication(tx, workspaceId, actorId, state.tables.VideoProduct[0]));
assert.deepEqual([state.tables.ComplianceIdentity.length, state.tables.ContentConsent.length], counts);
assert.equal((await context({ ...state.tables.VideoProduct[0], title: 'Changed' })).needsAttestation, true);
ready = await context({ ...state.tables.VideoProduct[0], mediaAssetId: id(9) });
assert.equal(ready.recordedOn, null);
assert.deepEqual(ready.missingConsentIds, [performerId]);
assert.equal(ready.needsAttestation, true);
state.tables.ComplianceIdentity[1].expiresAt = '2020-01-01T00:00:00Z';
assert.match((await context()).pending.join(' '), /Participant/);
await assert.rejects(() => db.transaction(tx => service.completeOwnerPublication(tx, workspaceId, actorId, state.tables.VideoProduct[0])), /identity/);
state.tables.ComplianceIdentity[1].expiresAt = null;
state.tables.ContentConsent.push({ ...state.tables.ContentConsent[0], status: 'REVOKED', recordedAt: '2099-01-01' });
assert.match((await context()).pending.join(' '), /revoked/);
await assert.rejects(() => db.transaction(tx => service.completeOwnerPublication(tx, workspaceId, actorId, state.tables.VideoProduct[0], evidence)), /revoked/);
state.tables.ContentConsent.pop();
state.tables.ComplianceIdentity[1].dateOfBirth = '2008-01-02';
await assert.rejects(() => db.transaction(tx => service.completeOwnerPublication(tx, workspaceId, actorId, state.tables.VideoProduct[0], { ...evidence, recordedOn: '2025-01-01' })), /identity/);
assert.equal(fields.ownerPublicationSchema.safeParse({ attest: false }).success, false);
assert.equal(fields.ownerPublicationSchema.safeParse({ consents: [] }).success, true);
const draft = { mediaAssetId: product.mediaAssetId, title: 'Video', slug: 'video', description: 'Description', priceCents: 100, currency: 'USD', category: 'Video', featured: false, status: 'DRAFT' };
assert.equal(fields.productInputSchema.safeParse(draft).success, true);
// The preflight handler has the same tenant, role and origin boundary as product writes.
state.userId = actorId;
state.tables.Workspace = [{ id: workspaceId, status: 'ACTIVE' }];
state.tables.MediaAsset = [{ id: product.mediaAssetId, workspaceId, status: 'UPLOADED' }];
state.tables.ComplianceIdentity[1].dateOfBirth = '1990-01-01';
const preflight = load('app/api/store/products/compliance/route.ts');
const request = (payload, origin = 'https://hotwifesonyc.com') => new Request('https://hotwifesonyc.com/api/store/products/compliance', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(payload) });
const payload = Object.fromEntries(['id', 'mediaAssetId', 'teaserMediaAssetId', 'thumbnailMediaAssetId', 'title', 'slug', 'description', 'category'].map(key => [key, product[key]]));
let response = await preflight.POST(request(payload));
assert.equal(response.status, 200);
const publicState = await response.json();
assert.equal(publicState.needsAttestation, false);
assert.ok(!JSON.stringify(publicState).includes('vault:'));
assert.equal((await preflight.POST(request({ ...payload, id: id(99) }))).status, 404);
assert.equal((await preflight.POST(request(payload, 'https://evil.test'))).status, 403);
state.tables.WorkspaceMember[0].role = 'ADMIN';
assert.equal((await preflight.POST(request(payload))).status, 403);
state.userId = null;
assert.equal((await preflight.POST(request(payload))).status, 401);
console.log('Direct publication: evidence reuse, missing records, changed content, expired identity, revoked consent, recording-age and draft checks passed.');
