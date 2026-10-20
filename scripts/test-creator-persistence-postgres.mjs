// Requires a disposable PostgreSQL cluster at 127.0.0.1:55439, user creator_test, data directory .tmp/creator-verification-pg. Never loads .env; refuses every other cluster.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { build } from 'esbuild';
import pg from 'pg';
const control = new pg.Client({ connectionString: 'postgresql://creator_test@127.0.0.1:55439/postgres' });
await control.connect();
assert.match((await control.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\', '/'), /\/HotwifeSonyC\/\.tmp\/creator-verification-pg$/i);
const database = 'creator_verification_test_' + process.pid;
await control.query(`CREATE DATABASE "${database}"`);
const url = `postgresql://creator_test@127.0.0.1:55439/${database}`;
const sql = new pg.Client({ connectionString: url });
let api;
try {
  await sql.connect();
  const contract = JSON.parse(fs.readFileSync('src/prisma/contract.json', 'utf8'));
  const names = ['user', 'workspace', 'workspaceMember', 'creator', 'performer', 'performerDocument', 'complianceIdentity', 'complianceNote', 'complianceReport', 'auditLog', 'contentReview', 'contentConsent', 'videoProduct', 'mediaAsset', 'mediaAssetPerformer', 'purchase'];
  const quote = value => '"' + value.replaceAll('"', '""') + '"';
  // Minimal test schema uses the installed contract's actual columns and SQL types.
  for (const name of names) {
    const table = contract.storage.namespaces.public.entries.table[name];
    const columns = Object.entries(table.columns).map(([name, column]) => {
      const def = column.default;
      const value = def?.kind === 'literal' ? typeof def.value === 'string' ? "'" + def.value.replaceAll("'", "''") + "'" : String(def.value) : def?.kind === 'function' ? def.expression : null;
      return `${quote(name)} ${column.nativeType}${column.nullable ? '' : ' NOT NULL'}${value ? ' DEFAULT ' + value : ''}`;
    });
    columns.push('PRIMARY KEY (' + table.primaryKey.columns.map(quote).join(',') + ')');
    await sql.query(`CREATE TABLE ${quote(name)} (${columns.join(',')})`);
  }
  const fixture = `import postgres from '@prisma/orm-postgres/runtime';import contract from './src/prisma/contract.json';export let db=postgres({contractJson:contract,url:${JSON.stringify(url)}});export const session={userId:null};export async function getCurrentSession(){return session.userId?{user:{id:session.userId}}:null;}export async function reconnect(){await db.close();db=postgres({contractJson:contract,url:${JSON.stringify(url)}});}`;
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `export {GET,POST} from './app/api/admin/compliance/route';export {complianceDashboard as inspectDashboard} from './src/lib/compliance/service';export {createProduct,updateProduct};import {POST as createProduct} from './app/api/store/products/route';import {PUT as updateProduct} from './app/api/store/products/[id]/route';export {listStorePerformers,listStoreProducts} from './src/lib/store/admin';export {getPublishedVideos} from './src/lib/store/public';export {db,session,reconnect} from 'fixture';` }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, plugins: [{ name: 'isolated-postgres', setup(b) {
    b.onResolve({ filter: /(?:prisma\/db$|auth\/session$|^\.\/session$|^fixture$|^server-only$)/ }, a => ({ path: a.path === 'server-only' ? 'empty' : 'fixture', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, a => ({ contents: a.path === 'empty' ? '' : fixture, loader: 'js', resolveDir: process.cwd() }));
    b.onResolve({ filter: /dotenv|storage\/r2/ }, a => { throw Error('Forbidden production dependency: ' + a.path); });
  } }] });
  const m = new Module(process.cwd() + '/scripts/creator-pg.memory.cjs'); m.filename = m.id; m.paths = Module._nodeModulePaths(process.cwd()); m._compile(bundle.outputFiles[0].text, m.filename); api = m.exports;
  const owner = await api.db.orm.public.User.create({ email: 'fictional-owner@example.test', passwordHash: 'not-a-real-password', status: 'ACTIVE' });
  const workspace = await api.db.orm.public.Workspace.create({ name: 'Isolated creator persistence test' });
  await api.db.orm.public.WorkspaceMember.create({ userId: owner.id, workspaceId: workspace.id, role: 'OWNER' }); api.session.userId = owner.id;
  const person = await api.db.orm.public.Performer.create({ workspaceId: workspace.id, displayName: 'Fictional creator' });
  const req = body => new Request('https://hotwifesonyc.com/api/admin/compliance', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://hotwifesonyc.com' }, body: JSON.stringify(body) });
  const post = async body => { const res = await api.POST(req(body)); assert.equal(res.status, 200, JSON.stringify(await res.clone().json())); assert.equal((await res.json()).ok, true); };
  const dashboard = async () => { await api.inspectDashboard(); const res = await api.GET(new Request('https://hotwifesonyc.com/api/admin/compliance')); assert.equal(res.status, 200); return res.json(); };
  await post({ action: 'creatorLink', displayName: 'Fictional creator', samePerson: true });
  assert.equal((await dashboard()).creatorProfiles.length, 1); // Reuses the existing profile.
  await post({ action: 'creatorProfile', performerId: person.id, displayName: 'Edited fictional creator', legalName: 'Fictional test name' });
  const document = await api.db.orm.public.PerformerDocument.create({ workspaceId: workspace.id, performerId: person.id, documentType: 'PHOTO_ID', title: 'Synthetic evidence only', objectKey: 'test-only/no-file', bucketName: 'isolated-no-storage', contentType: 'application/pdf', fileSize: 10n });
  const identity = { action: 'creatorIdentity', dateOfBirth: '1990-01-01', evidenceRef: 'document:' + document.id, expiresAt: null, samePerson: true, reviewed: true };
  await post(identity); const identityCount = (await api.db.orm.public.ComplianceIdentity.where({ workspaceId: workspace.id }).all()).length;
  await post(identity); assert.equal((await api.db.orm.public.ComplianceIdentity.where({ workspaceId: workspace.id }).all()).length, identityCount);
  api.session.userId = null; assert.equal((await api.GET(new Request('https://hotwifesonyc.com/api/admin/compliance'))).status, 401);
  await api.reconnect(); api.session.userId = owner.id;
  const recovered = await dashboard(); const card = recovered.creatorProfiles[0];
  assert.equal(card.displayName, 'Edited fictional creator'); assert.equal(card.status, 'Verified'); assert.equal(card.evidenceDocumentId, document.id); assert(card.reviewedAt);
  assert(!JSON.stringify(card).includes('objectKey')); assert(!JSON.stringify(card).includes('evidenceRef')); assert(!JSON.stringify(card).includes('documentNumber'));
  assert.equal((await api.listStorePerformers(workspace.id))[0].id, person.id);
  const distributionCreator = await api.db.orm.public.Creator.create({ workspaceId: workspace.id, displayName: 'Fictional distribution profile', ownerUserId: owner.id });
  const media = await api.db.orm.public.MediaAsset.create({ workspaceId: workspace.id, creatorId: distributionCreator.id, bucketName: 'isolated-no-storage', objectKey: 'test-only/video', originalFileName: 'synthetic.mp4', contentType: 'video/mp4', fileSize: 10n, mediaType: 'VIDEO', status: 'UPLOADED' });
  const input = { creatorId: person.id, mediaAssetId: media.id, title: 'Synthetic product', slug: 'synthetic-product', description: 'Isolated test only', priceCents: 100, currency: 'USD', category: 'Test', featured: false, status: 'DRAFT' };
  let res = await api.createProduct(req(input)); assert.equal(res.status, 201, JSON.stringify(await res.clone().json())); const product = (await res.json()).product;
  res = await api.updateProduct(req({ ...input, status: 'PUBLISHED' }), { params: Promise.resolve({ id: product.id }) }); assert.equal(res.status, 409);
  let videoCard = (await dashboard()).videoApprovals.find(video => video.id === product.id);
  assert.equal(videoCard.recordedOn, null); assert.equal(videoCard.consentAvailable, false); assert.equal(videoCard.rightsAvailable, false);
  await post({ action: 'creatorEvidence', productId: product.id, recordedOn: '2025-01-01' });
  await api.reconnect(); videoCard = (await dashboard()).videoApprovals.find(video => video.id === product.id);
  assert.equal(videoCard.recordedOn, '2025-01-01'); assert.equal(videoCard.status, 'Action Required'); assert.equal((await api.listStoreProducts(workspace.id))[0].publishedAt, null);
  const release = await api.db.orm.public.PerformerDocument.create({ workspaceId: workspace.id, performerId: person.id, documentType: 'RELEASE_FORM', title: 'Synthetic video consent and rights only', objectKey: 'test-only/release', bucketName: 'isolated-no-storage', contentType: 'application/pdf', fileSize: 10n });
  const evidence = { action: 'creatorEvidence', productId: product.id, consentEvidenceRef: 'document:' + release.id, rightsEvidenceRef: 'document:' + release.id };
  res = await api.POST(req(evidence)); assert.equal(res.status, 409); // An uploaded generic document is not coverage by itself.
  await post({ ...evidence, reviewed: true }); await api.reconnect();
  videoCard = (await dashboard()).videoApprovals.find(video => video.id === product.id);
  assert.equal(videoCard.recordedOn, '2025-01-01'); assert.equal(videoCard.consentAvailable, true); assert.equal(videoCard.rightsAvailable, true); assert.equal(videoCard.status, 'Action Required');
  assert.equal(videoCard.missing.length, 1); assert.match(videoCard.missing[0], /Content review/);
  const consentCount = (await api.db.orm.public.ContentConsent.where({ videoProductId: product.id }).all()).length;
  await post({ ...evidence, reviewed: true }); assert.equal((await api.db.orm.public.ContentConsent.where({ videoProductId: product.id }).all()).length, consentCount);
  await post({ action: 'creatorReview', productId: product.id, reviewed: true }); await api.reconnect();
  videoCard = (await dashboard()).videoApprovals.find(video => video.id === product.id); assert.equal(videoCard.status, 'Approved'); assert.deepEqual(videoCard.missing, []);
  // A second product must receive its own explicit consent association even when it uses the same document.
  res = await api.createProduct(req({ ...input, slug: 'second-synthetic-product' })); assert.equal(res.status, 201); const secondProduct = (await res.json()).product;
  assert.equal((await dashboard()).videoApprovals.find(video => video.id === secondProduct.id).consentAvailable, false);
  await sql.query(`CREATE FUNCTION test_fail_review() RETURNS trigger LANGUAGE plpgsql AS $test$BEGIN IF NEW."recordedOn"='2024-02-02' THEN RAISE EXCEPTION 'Synthetic persistence failure'; END IF; RETURN NEW; END;$test$`);
  await sql.query('CREATE TRIGGER test_fail_review BEFORE INSERT OR UPDATE ON "contentReview" FOR EACH ROW EXECUTE FUNCTION test_fail_review()');
  res = await api.POST(req({ ...evidence, productId: secondProduct.id, recordedOn: '2024-02-02', reviewed: true })); assert.equal(res.status, 500);
  assert.equal((await api.db.orm.public.ContentConsent.where({ videoProductId: secondProduct.id }).all()).length, 0); assert.equal((await dashboard()).videoApprovals.find(video => video.id === secondProduct.id).recordedOn, null);
  await sql.query('DROP TRIGGER test_fail_review ON "contentReview"'); await sql.query('DROP FUNCTION test_fail_review()');
  await post({ ...evidence, productId: secondProduct.id, recordedOn: '2025-01-01', reviewed: true });
  assert.equal((await api.db.orm.public.PerformerDocument.where({ performerId: person.id }).all()).length, 2);
  console.log('PASS: real PostgreSQL partial recording-date save and refresh, explicit per-video consent/rights association using an existing document, no duplicate consent, persisted APPROVED recovered by publication, generic document never auto-authorizes another video, actual SQL write failure rolls back the complete evidence save.');
  await api.db.orm.public.PerformerDocument.where({ id: release.id }).updateAndCount({ expiresAt: '2020-01-01T00:00:00.000Z' });
  res = await api.updateProduct(req({ ...input, status: 'PUBLISHED' }), { params: Promise.resolve({ id: product.id }) }); assert.equal(res.status, 409); assert.match((await res.json()).error, /expired/i);
  await api.db.orm.public.PerformerDocument.where({ id: release.id }).updateAndCount({ expiresAt: null });
  res = await api.updateProduct(req({ ...input, status: 'PUBLISHED' }), { params: Promise.resolve({ id: product.id }) }); assert.equal(res.status, 200); assert.equal((await api.getPublishedVideos()).length, 1);
  const replacement = await api.db.orm.public.PerformerDocument.create({ workspaceId: workspace.id, performerId: person.id, documentType: 'PHOTO_ID', title: 'Synthetic replacement only', objectKey: 'test-only/replacement', bucketName: 'isolated-no-storage', contentType: 'application/pdf', fileSize: 12n });
  await post({ action: 'creatorDocumentReplacement', performerId: person.id, documentId: replacement.id });
  assert.equal((await dashboard()).creatorProfiles[0].status, 'Action Required'); assert.equal((await api.listStoreProducts(workspace.id)).find(item => item.id === product.id).status, 'ARCHIVED');
  res = await api.updateProduct(req({ ...input, status: 'PUBLISHED' }), { params: Promise.resolve({ id: product.id }) }); assert.equal(res.status, 409);
  assert.equal((await api.db.orm.public.PerformerDocument.where({ performerId: person.id }).all()).length, 3);
  assert((await api.db.orm.public.AuditLog.where({ action: 'IDENTITY_DOCUMENT_REPLACED' }).all()).length > 0);
  await post({ ...identity, evidenceRef: 'document:' + replacement.id }); await api.reconnect();
  assert.equal((await dashboard()).creatorProfiles[0].status, 'Verified');
  res = await api.updateProduct(req({ ...input, status: 'PUBLISHED' }), { params: Promise.resolve({ id: product.id }) }); assert.equal(res.status, 200);
  await post({ action: 'creatorProfile', performerId: person.id, displayName: 'Edited fictional creator', status: 'INACTIVE' });
  assert.equal((await dashboard()).creatorProfiles.length, 1); assert.equal((await dashboard()).creatorProfiles[0].status, 'Action Required'); assert.equal((await api.listStorePerformers(workspace.id)).length, 0);
  await post({ action: 'creatorProfile', performerId: person.id, displayName: 'Edited fictional creator', status: 'ACTIVE' }); assert.equal((await dashboard()).creatorProfiles[0].status, 'Verified');
  console.log('PASS: real isolated PostgreSQL; existing profile reused, confirmed POST/GET, profile editing, identity reuse, logout/login fixture and new database connection, safe persistent cards, Creator selection, Draft/Publish, document replacement history and mandatory re-review. No production or R2 access.');
} finally {
  if (api) await api.db.close(); await sql.end();
  await control.query(`DROP DATABASE "${database}" WITH (FORCE)`); await control.end();
}
