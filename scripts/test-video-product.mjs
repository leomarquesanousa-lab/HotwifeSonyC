import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';

const source = await readFile('src/lib/store/product-fields.ts', 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const compiled = { exports: {} };
new Function('require', 'exports', outputText)(createRequire(import.meta.url), compiled.exports);
const { productInputSchema, resolveProductFields, formatPublishDate, parsePublishDate } = compiled.exports;
const ids = [1, 2, 3, 4].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
const existing = { mediaAssetId: ids[0], teaserMediaAssetId: ids[1], thumbnailMediaAssetId: ids[2], publishedAt: '2026-10-06T19:23:00.000Z' };
const base = { title: 'Video', slug: 'video', description: 'Description', priceCents: 100, currency: 'USD', category: 'Category', featured: false, status: 'PUBLISHED' };
const fields = ['mediaAssetId', 'teaserMediaAssetId', 'thumbnailMediaAssetId'];
for (const changed of fields) {
  const result = resolveProductFields(productInputSchema.parse({ ...base, [changed]: ids[3] }), existing);
  for (const field of fields) assert.equal(result[field], field === changed ? ids[3] : existing[field]);
  assert.equal(result.publishedAt, existing.publishedAt);
}
for (const value of [undefined, null]) {
  const result = resolveProductFields(productInputSchema.parse({ ...base, mediaAssetId: value, teaserMediaAssetId: value, thumbnailMediaAssetId: value }), existing);
  for (const field of fields) assert.equal(result[field], existing[field]);
}
const now = '2026-10-06T23:59:00.000Z';
assert.equal(resolveProductFields(productInputSchema.parse({ ...base, mediaAssetId: ids[0], publishedAt: null }), null, now).publishedAt, now);
assert.equal(resolveProductFields(productInputSchema.parse({ ...base, publishedAt: null }), existing, now).publishedAt, now);
assert.equal(resolveProductFields(productInputSchema.parse({ ...base, status: 'DRAFT' }), null, now).publishedAt, null);
assert.equal(parsePublishDate('02/29/2028'), '2028-02-29T00:00:00.000Z');
for (const invalid of ['02/29/2027', '04/31/2026', '13/01/2026', '10/6/2026']) assert.equal(parsePublishDate(invalid), null);
for (const timezone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
  process.env.TZ = timezone;
  assert.equal(formatPublishDate(existing.publishedAt), '10/06/2026');
  assert.equal(formatPublishDate(parsePublishDate('10/06/2026')), '10/06/2026');
  const scheduled = resolveProductFields(productInputSchema.parse({ ...base, publishedAt: '10/07/2026' }), existing, now);
  assert.equal(scheduled.publishedAt, '2026-10-07T00:00:00.000Z');
  assert.ok(new Date(scheduled.publishedAt).getTime() > new Date(now).getTime());
  assert.ok(new Date(scheduled.publishedAt).getTime() <= new Date('2026-10-07T00:00:00.000Z').getTime());
}
console.log('VideoProduct: media preservation, publication and timezone checks passed.');
