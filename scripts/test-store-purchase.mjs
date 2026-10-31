// Trusted payment-service simulation only: no real gateway, transaction or purchase.
import assert from 'node:assert/strict';
import Module from 'node:module';
import { build } from 'esbuild';
import { fixture } from './fixtures/store-db.mjs';
const root = process.cwd();
const result = await build({ stdin: { resolveDir: root, contents: `export * from './src/lib/store/purchases';export {getPublishedVideos,resolvePublicMedia} from './src/lib/store/public';export {state} from 'fixture';` }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, plugins: [{ name: 'isolate', setup(b) {
  b.onResolve({ filter: /(?:prisma\/db$|auth\/session$|^\.\/session$|^fixture$|^server-only$)/ }, a => ({ path: a.path === 'server-only' ? 'empty' : 'db', namespace: 'fixture' }));
  b.onResolve({ filter: /dotenv|storage\/r2/ }, () => { throw Error('Live dependency forbidden'); });
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path === 'empty' ? '' : fixture, loader: 'js' }));
} }] });
const mod = new Module(root + '/scripts/purchase.memory.cjs'); mod.filename = mod.id; mod.paths = Module._nodeModulePaths(root); mod._compile(result.outputFiles[0].text, mod.filename); const api = mod.exports;
const id = n => `88888888-8888-4888-8888-${String(n).padStart(12, '0')}`;
const userId = id(1), videoProductId = id(2), mediaId = id(3);
const payment = { userId, videoProductId, amountCents: 1999, currency: 'USD' };
function reset() { api.state.userId = userId; api.state.tables = { User: [{ id: userId, status: 'ACTIVE' }], Workspace: [{ id: 'workspace', status: 'ACTIVE' }], WorkspaceMember: [], VideoProduct: [{ id: videoProductId, workspaceId: 'workspace', title: 'Synthetic', slug: 'synthetic', status: 'PUBLISHED', complianceStatus: 'APPROVED', publishedAt: '2026-01-01T00:00:00Z', priceCents: 1999, currency: 'USD', mediaAssetId: mediaId, teaserMediaAssetId: null, thumbnailMediaAssetId: null }], MediaAsset: [{ id: mediaId, workspaceId: 'workspace', status: 'UPLOADED', mediaType: 'VIDEO', contentType: 'video/mp4', objectKey: 'synthetic-only', durationSeconds: 30 }], Purchase: [] }; }
reset(); await assert.rejects(() => api.requirePurchasedVideo(videoProductId), e => e.status === 403);
for (const value of [{ amountCents: 1 }, { currency: 'EUR' }]) await assert.rejects(() => api.recordApprovedPurchase({ ...payment, ...value }), e => e.status === 409);
assert.equal(api.state.tables.Purchase.length, 0);
const results = await Promise.all([api.recordApprovedPurchase(payment), api.recordApprovedPurchase(payment)]); assert.equal(results[0].id, results[1].id); assert.equal(api.state.tables.Purchase.length, 1); assert.equal((await api.requirePurchasedVideo(videoProductId)).id, videoProductId); assert.equal((await api.listPurchasedVideos()).length, 1);
api.state.tables.VideoProduct[0].status = 'ARCHIVED'; assert.equal((await api.requirePurchasedVideo(videoProductId)).id, videoProductId);
for (const status of ['PENDING', 'REFUNDED', 'CANCELED']) { api.state.tables.Purchase[0].status = status; await assert.rejects(() => api.requirePurchasedVideo(videoProductId), e => e.status === 403); }
reset(); api.state.tables.VideoProduct[0].publishedAt = '2099-01-01T00:00:00Z'; await assert.rejects(() => api.recordApprovedPurchase(payment), e => e.status === 404);
reset(); api.state.tables.Purchase = [{ ...payment, status: 'PAID' }];
for (const status of ['REJECTED', 'SUSPENDED', 'REMOVED']) {
  api.state.tables.VideoProduct[0].complianceStatus = status; assert.deepEqual(await api.getPublishedVideos(), []); assert.equal(await api.resolvePublicMedia('synthetic', 'thumbnail'), null);
  await assert.rejects(() => api.requirePurchasedVideo(videoProductId), e => e.status === 403);
}
console.log('PASS: synthetic trusted purchase validates price/currency, idempotency/concurrency, customer unlock, archive preservation, unpaid/refund denial, future publication and safety-restricted catalog/media. CCBill not integrated or simulated as live.');
