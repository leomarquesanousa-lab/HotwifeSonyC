// Real services/handlers with an isolated transactional database and session fixture. Never loads .env.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Module from 'node:module';
import fs from 'node:fs';
const root = process.cwd();
import { fixture } from './fixtures/store-db.mjs';

const result=await build({stdin:{contents:`export * from './src/lib/compliance/service';export * from './src/lib/compliance/validation';export {POST as publicPOST} from './app/api/compliance/reports/route';export {POST as adminPOST,GET as adminGET} from './app/api/admin/compliance/route';export {requirePurchasedVideo,listPurchasedVideos,getPurchasedVideoMedia} from './src/lib/store/purchases';export {saveStoreProduct,archiveStoreProduct,getStoreRemovalPreview} from './src/lib/store/admin';export {DELETE as deleteProduct} from './app/api/store/products/[id]/route';export {getPublishedVideos} from './src/lib/store/public';export {state,db} from 'fixture';`,resolveDir:root},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'isolate',setup(b){b.onResolve({filter:/(?:prisma\/db$|auth\/session$|^\.\/session$|^fixture$|^server-only$)/},args=>({path:args.path==='server-only'?'server-only':'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='server-only'?'':fixture,loader:'js'}));}}]});
const m=new Module(root+'/scripts/compliance-tests.memory.cjs');m.filename=root+'/scripts/compliance-tests.memory.cjs';m.paths=Module._nodeModulePaths(root);m._compile(result.outputFiles[0].text,m.filename);const a=m.exports;
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const workspace=id(1),owner=id(2),admin=id(3),operator=id(4),person=id(5),productId=id(6),mediaId=id(7),customer=id(8),otherWorkspace=id(9);
const product={id:productId,workspaceId:workspace,mediaAssetId:mediaId,teaserMediaAssetId:null,thumbnailMediaAssetId:null,title:'Original collection',slug:'original',description:'Original video',category:'Original',status:'DRAFT',complianceStatus:'DRAFT',priceCents:100,currency:'USD',featured:false,publishedAt:null};
Object.assign(a.state.tables,{Workspace:[{id:workspace,status:'ACTIVE'},{id:otherWorkspace,status:'ACTIVE'}],User:[{id:owner,status:'ACTIVE'},{id:admin,status:'ACTIVE'},{id:operator,status:'ACTIVE'}],WorkspaceMember:[{workspaceId:workspace,userId:owner,role:'OWNER'},{workspaceId:workspace,userId:admin,role:'ADMIN'},{workspaceId:workspace,userId:operator,role:'OPERATOR'}],Performer:[{id:person,workspaceId:workspace,status:'ACTIVE',displayName:'Test performer'}],VideoProduct:[product],MediaAsset:[{id:mediaId,workspaceId:workspace,status:'UPLOADED',mediaType:'VIDEO',contentType:'video/mp4'}],MediaAssetPerformer:[{workspaceId:workspace,mediaAssetId:mediaId,performerId:person}]});
const request=(url,body,headers={})=>new Request('https://hotwifesonyc.com'+url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const report={contentUrl:'https://hotwifesonyc.com/videos/original',reason:'Underage concern',reporterName:'Test reporter',reporterEmail:'reporter@example.test',depictedPerson:false,description:'Please investigate the age verification associated with this page.',supportingInfo:'A reference can be supplied privately.',truthful:true,website:''};
let response=await a.publicPOST(request('/api/compliance/reports',report));assert.equal(response.status,201);const receipt=await response.json();assert.deepEqual(Object.keys(receipt).sort(),['dueAt','reference','status']);assert.equal(a.state.tables.ComplianceReport[0].priority,'HIGH');assert.equal(a.state.tables.ComplianceReport[0].workspaceId,workspace);assert.ok(a.state.tables.AuditLog.some(e=>e.action==='COMPLAINT_OPENED'));
response=await a.publicPOST(request('/api/compliance/reports',{...report,kind:'DEPICTED_PERSON',reporterEmail:'depicted@example.test'}));assert.equal(response.status,201);assert.ok(a.state.tables.AuditLog.some(e=>e.action==='DEPICTED_PERSON_APPEAL_RECEIVED'));
for(const change of [{website:'spam'},{contentUrl:'https://evil.test/private'},{contentUrl:'https://hotwifesonyc.com/video?X-Amz-Signature=secret'},{description:'short'},{truthful:false}]){assert.equal((await a.publicPOST(request('/api/compliance/reports',{...report,...change}))).status,400);}
assert.equal((await a.publicPOST(request('/api/compliance/reports',report,{'origin':'https://evil.test'}))).status,403);
assert.equal((await a.publicPOST(request('/api/compliance/reports',report,{'sec-fetch-site':'cross-site'}))).status,403);
for(let i=0;i<4;i++)assert.equal((await a.publicPOST(request('/api/compliance/reports',report))).status,201);
assert.equal((await a.publicPOST(request('/api/compliance/reports',report))).status,429);
const reportCount=a.state.tables.ComplianceReport.length;a.state.failTable='AuditLog';assert.equal((await a.publicPOST(request('/api/compliance/reports',{...report,reporterEmail:'rollback@example.test'}))).status,500);assert.equal(a.state.tables.ComplianceReport.length,reportCount);a.state.failTable=null;
assert.equal(a.businessDeadline(new Date('2026-10-09T12:00:00Z')),'2026-10-16T12:00:00.000Z');assert.equal(a.adultOn('2008-10-12','2026-10-11'),false);assert.equal(a.adultOn('2008-10-11','2026-10-11'),true);
for(const [user,status] of [[null,401],[customer,403],[operator,403],[owner,200],[admin,200]]){a.state.userId=user;assert.equal((await a.adminGET(new Request('https://hotwifesonyc.com/api/admin/compliance'))).status,status);}
a.state.userId=owner;
await assert.rejects(()=>a.db.transaction(tx=>a.assertCommercialPublication(tx,workspace,product,null)),/Save as draft/);
await assert.rejects(()=>a.db.transaction(tx=>a.assertCommercialPublication(tx,workspace,product,product)),/approved/);
const review={action:'review',productId,status:'APPROVED',providerUserId:owner,recordedOn:'2026-01-01',allPersonsConfirmed:true,prohibitedChecked:true,copyrightConfirmed:true,note:'Reviewed the actual material and evidence.'};
await assert.rejects(()=>a.complianceAction(review),/verification/);
const identity={action:'identity',subjectType:'USER',subjectId:owner,status:'VERIFIED',dateOfBirth:'1990-01-01',evidenceRef:'protected-vault:provider',expiresAt:null,attest:true};
await a.complianceAction(identity);await assert.rejects(()=>a.complianceAction(review),/verification/);
await a.complianceAction({...identity,subjectType:'PERFORMER',subjectId:person,evidenceRef:'protected-vault:performer'});
await assert.rejects(()=>a.complianceAction(review),/consent/);
const consent={action:'consent',productId,performerId:person,evidenceRef:'protected-vault:signed-release',depiction:true,distribution:true,publication:false,downloads:false,status:'RECORDED',attest:true};
await a.complianceAction(consent);await assert.rejects(()=>a.complianceAction(review),/consent/);
await a.complianceAction({...consent,publication:true});assert.equal(a.state.tables.ContentConsent.length,2);
await a.complianceAction(review);let current=a.state.tables.VideoProduct[0];await a.db.transaction(tx=>a.assertCommercialPublication(tx,workspace,current,current));
await a.db.transaction(tx=>a.assertCommercialPublication(tx,workspace,{...current,title:'Changed promotion'},current)); // Commercial metadata reuses the same approved media evidence.
await assert.rejects(()=>a.db.transaction(tx=>a.assertCommercialPublication(tx,workspace,{...current,mediaAssetId:id(20)},current)),/review/);
const secondPerson=id(21);a.state.tables.MediaAssetPerformer.push({workspaceId:workspace,mediaAssetId:mediaId,performerId:secondPerson});await assert.rejects(()=>a.complianceAction(review),/unavailable/);a.state.tables.MediaAssetPerformer.pop();
const legacy={...current,id:id(22),status:'PUBLISHED',complianceStatus:'LEGACY_UNREVIEWED'};await a.db.transaction(tx=>a.assertCommercialPublication(tx,workspace,legacy,legacy));
current=a.state.tables.VideoProduct[0];current.status='PUBLISHED';await a.complianceAction({...consent,publication:true,status:'DISPUTED'});assert.equal(current.complianceStatus,'SUSPENDED');assert.equal(current.status,'ARCHIVED');assert.ok(a.state.tables.AuditLog.some(e=>e.action==='CONTENT_SUSPENDED'));await assert.rejects(()=>a.requirePurchasedVideo(productId),/safety review/);
a.state.tables.Purchase=[{userId:customer,videoProductId:productId,status:'PAID'}];a.state.userId=customer;await assert.rejects(()=>a.requirePurchasedVideo(productId),/safety review/);a.state.userId=owner;
await a.complianceAction({action:'moderate',productId,status:'REMOVED',note:'Identified unlawful material. Removed from availability.'});assert.equal(a.state.tables.VideoProduct[0].complianceStatus,'REMOVED');
await a.complianceAction({action:'report',id:receipt.reference,status:'RESOLVED',note:'Reviewed records and documented the protective action.'});assert.equal(a.state.tables.ComplianceReport[0].status,'RESOLVED');assert.equal(a.state.tables.ComplianceNote.length>0,true);
await assert.rejects(()=>a.complianceAction({action:'moderate',productId:id(99),status:'REMOVED',note:'Cross-workspace request.'}),/not found/);
a.state.userId=operator;assert.equal((await a.adminPOST(request('/api/admin/compliance',{action:'moderate',productId,status:'REMOVED',note:'Should be denied.'}))).status,403);
const serialized=JSON.stringify(receipt);assert.ok(!serialized.includes(report.reporterEmail));
const migration=JSON.parse(fs.readFileSync('migrations/app/20261012T0208_safety_compliance/migration.json','utf8'));assert.equal(migration.from,'c84b413e7a38092b8187b7e13347b071097f9d151b82e7e29c6f54a30040b686');
const deletionProduct={...product,status:'PUBLISHED',complianceStatus:'LEGACY_UNREVIEWED',publishedAt:'2026-01-01T00:00:00.000Z',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'};
const deleteRequest=(body={confirmed:true},origin='https://hotwifesonyc.com')=>a.deleteProduct(new Request('https://hotwifesonyc.com/api/store/products/'+productId,{method:'DELETE',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({id:productId})});
for(const [user,expected] of [[null,401],[customer,403],[operator,403],[owner,200],[admin,200]]){
  a.state.userId=user;a.state.tables.VideoProduct=[structuredClone(deletionProduct)];a.state.tables.AuditLog=[];
  const sharedProduct={...deletionProduct,id:id(66),slug:'shared-media-product',status:'DRAFT'};a.state.tables.VideoProduct.push(structuredClone(sharedProduct));
  const beforePurchases=structuredClone(a.state.tables.Purchase),beforeMedia=structuredClone(a.state.tables.MediaAsset);
  assert.equal((await deleteRequest()).status,expected);
  assert.deepEqual(a.state.tables.Purchase,beforePurchases);assert.deepEqual(a.state.tables.MediaAsset,beforeMedia);
  assert.deepEqual(a.state.tables.VideoProduct[1],sharedProduct);
  if(expected===200){assert.equal(a.state.tables.VideoProduct[0].status,'ARCHIVED');assert.equal(a.state.tables.VideoProduct[0].complianceStatus,'LEGACY_UNREVIEWED');assert.equal(a.state.tables.AuditLog.length,1);assert.equal(a.state.tables.AuditLog[0].userId,user);assert.equal(a.state.tables.AuditLog[0].action,'CONTENT_ARCHIVED');assert.equal(a.state.tables.AuditLog[0].entityId,productId);assert.ok(a.state.tables.AuditLog[0].createdAt);}
  else assert.equal(a.state.tables.VideoProduct[0].status,'PUBLISHED');
}
a.state.userId=owner;a.state.tables.VideoProduct=[structuredClone(deletionProduct)];a.state.tables.AuditLog=[];
await Promise.all([deleteRequest(),deleteRequest()]);assert.equal(a.state.tables.AuditLog.length,1);
assert.deepEqual(await a.getPublishedVideos(),[]);
a.state.userId=customer;assert.equal((await a.requirePurchasedVideo(productId)).id,productId);
a.state.userId=owner;assert.equal((await deleteRequest({confirmed:false})).status,400);assert.equal((await deleteRequest({confirmed:true},'https://evil.test')).status,403);
a.state.tables.VideoProduct=[{...deletionProduct,workspaceId:otherWorkspace}];assert.equal((await deleteRequest()).status,404);
a.state.tables.VideoProduct=[structuredClone(deletionProduct)];a.state.tables.AuditLog=[];a.state.failTable='AuditLog';assert.equal((await deleteRequest()).status,500);a.state.failTable=null;assert.equal(a.state.tables.VideoProduct[0].status,'PUBLISHED');assert.equal(a.state.tables.AuditLog.length,0);
console.log('PASS: Compliance suite plus OWNER/ADMIN archive, unauthorized denial, confirmation/CSRF/tenant checks, public removal, paid access/history/media preservation, audit, concurrent idempotency and rollback.');

// Paid-only removal preview, plus retained library/playback after archive.
a.state.userId=owner;a.state.tables.VideoProduct=[structuredClone(deletionProduct)];a.state.tables.Purchase=[];assert.equal((await a.getStoreRemovalPreview(productId)).paidPurchaseCount,0);
a.state.tables.Purchase=['PAID','PAID','PAID','CANCELED','REFUNDED','PENDING'].map((status,i)=>({id:id(80+i),userId:i===0?customer:id(90+i),videoProductId:productId,status,createdAt:'2026-01-01T00:00:00.000Z'}));assert.equal((await a.getStoreRemovalPreview(productId)).paidPurchaseCount,3);
a.state.userId=operator;await assert.rejects(()=>a.getStoreRemovalPreview(productId),e=>e.status===403);a.state.userId=owner;await a.archiveStoreProduct(productId);a.state.userId=customer;assert.equal((await a.listPurchasedVideos())[0].id,productId);a.state.tables.MediaAsset[0].objectKey='protected/test.mp4';assert.deepEqual(await a.getPurchasedVideoMedia(productId,'full'),{objectKey:'protected/test.mp4',contentType:'video/mp4'});assert.deepEqual(await a.getPublishedVideos(),[]);console.log('PASS: paid-only preview (0/3), OPERATOR denied, archived product retained in My Videos with full playback media access.');

// Permanent deletion: isolated fixtures, preserve media and all historical references.
a.state.userId=owner;
for(const table of ['ContentReview','ContentConsent','ComplianceReport'])a.state.tables[table]=[];
a.state.tables.VideoProduct=[structuredClone(deletionProduct)];a.state.tables.Purchase=[];a.state.tables.AuditLog=[];
const preservedMedia=structuredClone(a.state.tables.MediaAsset);
assert.equal((await a.getStoreRemovalPreview(productId)).permanentDeletionAllowed,true);
assert.equal((await deleteRequest({confirmed:true,action:'permanent'})).status,200);
assert.equal(a.state.tables.VideoProduct.length,0);assert.deepEqual(a.state.tables.MediaAsset,preservedMedia);assert.equal(a.state.tables.AuditLog[0].action,'CONTENT_DELETED');assert.equal(a.state.tables.AuditLog[0].entityId,productId);
for(const role of [owner,admin]){a.state.userId=role;a.state.tables.VideoProduct=[structuredClone(deletionProduct)];assert.equal((await deleteRequest({confirmed:true,action:'permanent'})).status,200);}
a.state.userId=operator;a.state.tables.VideoProduct=[structuredClone(deletionProduct)];assert.equal((await deleteRequest({confirmed:true,action:'permanent'})).status,403);
a.state.userId=owner;a.state.tables.Purchase=[{id:id(150),userId:customer,videoProductId:productId,status:'PAID'}];
response=await deleteRequest({confirmed:true,action:'permanent'});assert.equal(response.status,409);assert.match((await response.json()).error,/existing purchases/);assert.equal(a.state.tables.Purchase.length,1);assert.equal((await deleteRequest()).status,200);
a.state.userId=customer;assert.equal((await a.requirePurchasedVideo(productId)).id,productId);assert.equal((await a.listPurchasedVideos())[0].id,productId);
a.state.userId=owner;a.state.tables.Purchase[0].status='CANCELED';assert.equal((await deleteRequest({confirmed:true,action:'permanent'})).status,409);a.state.tables.Purchase=[];
for(const table of ['ContentReview','ContentConsent','ComplianceReport']){a.state.tables[table]=[{id:id(160),videoProductId:productId}];assert.equal((await deleteRequest({confirmed:true,action:'permanent'})).status,409);a.state.tables[table]=[];}
a.state.failTable='AuditLog';assert.equal((await deleteRequest({confirmed:true,action:'permanent'})).status,409);a.state.failTable=null;assert.equal(a.state.tables.VideoProduct.length,1);assert.deepEqual(a.state.tables.MediaAsset,preservedMedia);
console.log('PASS: permanent delete OWNER/ADMIN only, PAID/history/compliance blockers, retained buyer access, media preservation, CONTENT_DELETED audit and transactional rollback.');
