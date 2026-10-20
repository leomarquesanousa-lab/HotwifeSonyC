// Real services/handlers with an isolated transactional database and session fixture. Never loads .env.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Module from 'node:module';
const root = process.cwd();
import { fixture } from './fixtures/store-db.mjs';

const result=await build({stdin:{contents:`export * from './src/lib/compliance/service';export * from './src/lib/compliance/validation';export {POST as publicPOST} from './app/api/compliance/reports/route';export {POST as adminPOST,GET as adminGET} from './app/api/admin/compliance/route';export {requirePurchasedVideo,listPurchasedVideos,getPurchasedVideoMedia} from './src/lib/store/purchases';export {listStoreProducts,listStorePerformers,saveStoreProduct,archiveStoreProduct,getStoreRemovalPreview} from './src/lib/store/admin';export {DELETE as deleteProduct} from './app/api/store/products/[id]/route';export {POST as createProduct} from './app/api/store/products/route';export {PUT as updateProduct} from './app/api/store/products/[id]/route';export {resolvePublicMedia,getPublishedVideos} from './src/lib/store/public';export {state,db} from 'fixture';`,resolveDir:root},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'isolate',setup(b){b.onResolve({filter:/(?:prisma\/db$|auth\/session$|^\.\/session$|^fixture$|^server-only$)/},args=>({path:args.path==='server-only'?'server-only':'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='server-only'?'':fixture,loader:'js'}));}}]});
const m=new Module(root+'/scripts/compliance-tests.memory.cjs');m.filename=root+'/scripts/compliance-tests.memory.cjs';m.paths=Module._nodeModulePaths(root);m._compile(result.outputFiles[0].text,m.filename);const a=m.exports;
const id=n=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`;
const workspace=id(1),owner=id(2),admin=id(3),operator=id(4),customer=id(5),person=id(6),media=id(7),teaser=id(8),cover=id(9);
const input={mediaAssetId:media,teaserMediaAssetId:teaser,thumbnailMediaAssetId:cover,title:'Owner video',slug:'owner-video',description:'Original content',category:'Original',priceCents:1999,currency:'USD',featured:true,status:'DRAFT'};
const legal={recordedOn:'2025-01-01',attest:true,consents:[{performerId:person,evidenceRef:'protected-vault:signed-release'}]};
const seed={Workspace:[{id:workspace,status:'ACTIVE'}],WorkspaceMember:[{workspaceId:workspace,userId:owner,role:'OWNER'},{workspaceId:workspace,userId:admin,role:'ADMIN'},{workspaceId:workspace,userId:operator,role:'OPERATOR'}],User:[owner,admin,operator,customer].map(id=>({id,status:'ACTIVE'})),Performer:[{id:person,workspaceId:workspace,status:'ACTIVE'}],ComplianceIdentity:[{id:id(10),workspaceId:workspace,subjectType:'USER',subjectId:owner,status:'VERIFIED',dateOfBirth:'1990-01-01',evidenceRef:'protected-vault:owner',createdAt:'2025-01-01',expiresAt:null},{id:id(11),workspaceId:workspace,subjectType:'PERFORMER',subjectId:person,status:'VERIFIED',dateOfBirth:'1990-01-01',evidenceRef:'protected-vault:performer',createdAt:'2025-01-01',expiresAt:null}],MediaAsset:[{id:media,workspaceId:workspace,status:'UPLOADED',mediaType:'VIDEO',contentType:'video/mp4',durationSeconds:600,objectKey:'private/full.mp4'},{id:teaser,workspaceId:workspace,status:'UPLOADED',mediaType:'VIDEO',contentType:'video/mp4',objectKey:'public/teaser.mp4'},{id:cover,workspaceId:workspace,status:'UPLOADED',mediaType:'IMAGE',contentType:'image/jpeg',objectKey:'public/cover.jpg'}],MediaAssetPerformer:[{workspaceId:workspace,mediaAssetId:media,performerId:person}],VideoProduct:[],ContentReview:[],ContentConsent:[],AuditLog:[],Purchase:[]};
function reset(){a.state.tables=structuredClone(seed);a.state.userId=owner;a.state.failTable=null;}
function req(body,method='POST',origin='https://hotwifesonyc.com'){return new Request('https://hotwifesonyc.com/api/store/products',{method,headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});}
const create=body=>a.createProduct(req(body));
const update=(body,id)=>a.updateProduct(req(body,'PUT'),{params:Promise.resolve({id})});
const publish={...input,status:'PUBLISHED',ownerPublication:legal};
reset();const mediaBefore=structuredClone(a.state.tables.MediaAsset);
let response=await create(input);assert.equal(response.status,201);let product=(await response.json()).product;assert.equal(product.status,'DRAFT');assert.equal(a.state.tables.ContentReview.length,0);assert.equal((await a.getPublishedVideos()).length,0);
response=await update({...input,status:'PUBLISHED',ownerPublication:legal},product.id);assert.equal(response.status,200);product=(await response.json()).product;assert.equal(product.status,'PUBLISHED');assert.equal((await a.getPublishedVideos())[0].id,product.id);assert.equal(a.state.tables.VideoProduct.length,1);assert.equal(a.state.tables.ContentReview[0].status,'APPROVED');assert.equal(a.state.tables.ContentReview[0].fingerprint,a.contentFingerprint(a.state.tables.VideoProduct[0]));assert(!('ownerPublication' in a.state.tables.VideoProduct[0]));
assert.equal(await a.resolvePublicMedia(product.slug,'full'),null);assert.deepEqual(await a.resolvePublicMedia(product.slug,'teaser'),{objectKey:'public/teaser.mp4',contentType:'video/mp4'});a.state.userId=customer;await assert.rejects(()=>a.requirePurchasedVideo(product.id));a.state.userId=owner;
response=await update({...input,status:'DRAFT'},product.id);assert.equal(response.status,200);assert.equal((await a.getPublishedVideos()).length,0);response=await update({...input,status:'PUBLISHED'},product.id);assert.equal(response.status,200);assert.equal((await a.getPublishedVideos()).length,1);assert.deepEqual(a.state.tables.MediaAsset,mediaBefore);assert.equal(a.state.tables.AuditLog.some(e=>e.action==='CONTENT_PUBLISHED'&&e.userId===owner),true);
console.log('PASS: OWNER draft -> direct publish -> storefront -> draft -> publish using validated existing evidence; private full video protected; media preserved; audit present.');
reset();response=await create(publish);assert.equal(response.status,201);product=(await response.json()).product;assert.equal(product.status,'PUBLISHED');assert.equal(a.state.tables.VideoProduct.length,1);assert.equal((await a.getPublishedVideos()).length,1);for(const k of ['mediaAssetId','teaserMediaAssetId','thumbnailMediaAssetId','category','priceCents'])assert.equal(product[k],input[k]);assert.equal((await create(publish)).status,409);assert.equal(a.state.tables.VideoProduct.length,1);console.log('PASS: direct publication at creation, all product data retained, duplicate slug blocked.');
for(const [user,code] of [[null,401],[customer,403],[admin,403],[operator,403]]){reset();a.state.userId=user;assert.equal((await create(publish)).status,code);assert.equal(a.state.tables.VideoProduct.length,0);}
for(const user of [admin,operator]){reset();a.state.userId=user;assert.equal((await create({...input,status:'PUBLISHED'})).status,409);assert.equal((await create(input)).status,201);}
reset();assert.equal((await a.createProduct(req(publish,'POST','https://evil.test'))).status,403);await assert.rejects(()=>a.saveStoreProduct(id(99),publish),e=>e.status===403);console.log('PASS: anonymous/customer denied, OWNER-only legal intake, other administrative roles retain draft and manual-review permissions, CSRF/tenant checks retained.');
for(const mutate of [s=>s.ComplianceIdentity.splice(0,1),s=>s.ComplianceIdentity[1].dateOfBirth='2015-01-01',s=>s.ComplianceIdentity[1].expiresAt='2020-01-01T00:00:00Z',s=>s.ComplianceIdentity[1].evidenceRef='',s=>s.Performer[0].status='INACTIVE',s=>s.User[0].status='SUSPENDED',s=>s.MediaAssetPerformer.push({workspaceId:workspace,mediaAssetId:teaser,performerId:id(55)}),s=>s.MediaAsset[1].id=media]){reset();mutate(a.state.tables);const denied=await create(publish);assert([400,409].includes(denied.status));assert.equal(a.state.tables.VideoProduct.length,0);assert.equal(a.state.tables.ContentConsent.length,0);assert.equal(a.state.tables.ContentReview.length,0);}
for(const change of [{recordedOn:'2099-01-01'},{recordedOn:'2025-02-30'},{attest:false},{consents:[{performerId:person,evidenceRef:''}]}]){reset();assert.equal((await create({...publish,ownerPublication:{...legal,...change}})).status,400);assert.equal(a.state.tables.VideoProduct.length,0);}
reset();assert.equal((await create({...publish,ownerPublication:{...legal,consents:[]}})).status,409);assert.equal(a.state.tables.VideoProduct.length,0);
reset();assert.equal((await create({...input,status:'PUBLISHED'})).status,409);assert.equal(a.state.tables.VideoProduct.length,0);
for(const status of ['REJECTED','SUSPENDED','REMOVED']){reset();product=(await (await create(input)).json()).product;a.state.tables.VideoProduct[0].complianceStatus=status;assert.equal((await update(publish,product.id)).status,409);assert.equal(a.state.tables.VideoProduct[0].status,'DRAFT');}
for(const status of ['DISPUTED','REVOKED']){reset();product=(await (await create(input)).json()).product;a.state.tables.ContentConsent=[{id:id(70),workspaceId:workspace,videoProductId:product.id,performerId:person,status,recordedAt:'2026-01-01'}];assert.equal((await update(publish,product.id)).status,409);assert.equal(a.state.tables.ContentConsent.length,1);}
reset();a.state.failTable='AuditLog';assert.equal((await create(publish)).status,500);assert.equal(a.state.tables.VideoProduct.length,0);assert.equal(a.state.tables.ContentReview.length,0);assert.equal(a.state.tables.ContentConsent.length,0);console.log('PASS: required identities/age/expiry/evidence/consent/rights/content checks, moderation blockers and full transactional rollback. No live services.');
reset();product=(await (await create(input)).json()).product;
a.state.tables.ContentReview=[{id:id(80),workspaceId:workspace,videoProductId:product.id,status:'REJECTED'}];
assert.equal((await update({...publish,title:'Changed title'},product.id)).status,409);assert.equal(a.state.tables.ContentReview[0].status,'REJECTED');
reset();product=(await (await create(input)).json()).product;a.state.tables.VideoProduct[0].complianceStatus='REJECTED';a.state.tables.ContentReview=[{id:id(80),workspaceId:workspace,videoProductId:product.id,status:'REJECTED'}];assert.equal((await update({...input,title:'Changed draft title'},product.id)).status,200);assert.equal(a.state.tables.VideoProduct[0].complianceStatus,'REJECTED');assert.equal(a.state.tables.ContentReview[0].status,'REJECTED');assert.equal((await update(publish,product.id)).status,409);
reset();product=(await (await create(publish)).json()).product;a.state.userId=admin;assert.equal((await update({...input,status:'DRAFT'},product.id)).status,200);assert.equal((await update({...input,status:'PUBLISHED'},product.id)).status,200);
reset();product=(await (await create(publish)).json()).product;await update({...input,status:'DRAFT'},product.id);a.state.tables.ComplianceIdentity[1].expiresAt='2020-01-01T00:00:00Z';assert.equal((await update({...input,status:'PUBLISHED'},product.id)).status,409);assert.equal(a.state.tables.VideoProduct[0].status,'DRAFT');
reset();a.state.tables.WorkspaceMember.push({userId:customer,workspaceId:workspace,role:'MEMBER'});a.state.userId=customer;assert.equal((await create(publish)).status,403);
reset();a.state.failTable='ContentReview';assert.equal((await create(publish)).status,500);assert.equal(a.state.tables.VideoProduct.length,0);assert.equal(a.state.tables.ContentConsent.length,0);
reset();product=(await (await create(input)).json()).product;Object.assign(a.state.tables.VideoProduct[0],{status:'PUBLISHED',complianceStatus:'LEGACY_UNREVIEWED',publishedAt:'2025-01-01T00:00:00Z'});assert.equal((await update({...input,status:'PUBLISHED'},product.id)).status,200);assert.equal(a.state.tables.ContentReview.length,0);
console.log('PASS: rejected content cannot be reset through Draft/metadata edits, approved ADMIN flow and unchanged legacy flow preserved, identity expiry rechecked, member role denied, review-write rollback.');

reset(); product=(await (await create(publish)).json()).product;
const beforeConsent=a.state.tables.ContentConsent.length;
let context=await a.ownerPublicationContext(a.db,workspace,owner,{...product,title:'Updated title',description:'Updated description'});
assert.equal(context.needsAttestation,false);assert.deepEqual(context.missingConsentIds,[]);
response=await update({...input,title:'Updated title',description:'Updated description',status:'PUBLISHED'},product.id);assert.equal(response.status,200);assert.equal(a.state.tables.ContentConsent.length,beforeConsent);
context=await a.ownerPublicationContext(a.db,workspace,owner,{...a.state.tables.VideoProduct[0],thumbnailMediaAssetId:null});assert.equal(context.needsAttestation,true);
console.log('PASS: metadata edits reuse approved rights and consent; changed media still requires review.');

reset();product=(await (await create(publish)).json()).product;
assert.equal((await update({...input,title:'Revised draft',status:'DRAFT'},product.id)).status,200);
context=await a.ownerPublicationContext(a.db,workspace,owner,a.state.tables.VideoProduct[0]);assert.equal(context.needsAttestation,false);assert.deepEqual(context.missingConsentIds,[]);
assert.equal((await update({...input,title:'Revised draft',status:'PUBLISHED'},product.id)).status,200);
console.log('PASS: Save Draft after metadata edits preserves validated review and publishes without repeated intake.');

// A single account-level identity review is reused across independent products.
reset();a.state.tables.ComplianceIdentity=a.state.tables.ComplianceIdentity.filter(row=>row.subjectType!=='USER');
response=await create(publish);assert.equal(response.status,409);assert.match((await response.json()).error,/Creator: No identity verification.*one real identity review/);assert.equal(a.state.tables.VideoProduct.length,0);
await a.complianceAction({action:'identity',subjectType:'USER',subjectId:owner,status:'VERIFIED',dateOfBirth:'1990-01-01',evidenceRef:'test-vault:one-time-owner-review',expiresAt:null,attest:true});
response=await create(publish);assert.equal(response.status,201);
response=await create({...publish,title:'Second product',slug:'second-product'});assert.equal(response.status,201);
assert.equal(a.state.tables.ComplianceIdentity.filter(row=>row.subjectType==='USER').length,1);
assert.equal(a.state.tables.ComplianceIdentity.find(row=>row.subjectType==='USER').subjectId,owner);
for(const scenario of ['other-user','other-workspace','performer-only','expired','rejected-latest','missing-evidence']){
reset();const identity=a.state.tables.ComplianceIdentity.find(row=>row.subjectType==='USER');
if(scenario==='other-user')identity.subjectId=admin;
if(scenario==='other-workspace')identity.workspaceId=id(999);
if(scenario==='performer-only')a.state.tables.ComplianceIdentity=a.state.tables.ComplianceIdentity.filter(row=>row.subjectType!=='USER');
if(scenario==='expired')identity.expiresAt='2020-01-01T00:00:00Z';
if(scenario==='missing-evidence')identity.evidenceRef='';
if(scenario==='rejected-latest')a.state.tables.ComplianceIdentity.push({...identity,id:id(998),status:'REJECTED',createdAt:'2099-01-01'});
response=await create(publish);assert.equal(response.status,409,scenario);assert.match((await response.json()).error,/Creator:/);assert.equal(a.state.tables.VideoProduct.length,0);
}
console.log('PASS: missing OWNER identity gives a precise setup requirement; one actual identity-review action is reused by two products; wrong user/workspace, performer-only, expired, missing-evidence and latest rejected records cannot bypass the requirement.');

// Publishing is commercial: reuse the actual provider's review instead of replacing it with the actor.
reset();product=(await (await create(publish)).json()).product;
const providerIdentity=a.state.tables.ComplianceIdentity.find(row=>row.subjectType==='USER');providerIdentity.subjectId=admin;
a.state.tables.ContentReview[0].providerUserId=admin;
const originalReview=structuredClone(a.state.tables.ContentReview[0]);
const countIdentities=a.state.tables.ComplianceIdentity.length,countConsents=a.state.tables.ContentConsent.length;
response=await update({...input,title:'Commercial metadata only',status:'PUBLISHED'},product.id);assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
assert.equal(a.state.tables.ContentReview.length,1);assert.equal(a.state.tables.ContentReview[0].providerUserId,admin);
for(const key of ['reviewedBy','reviewedAt','decision','recordedOn'])assert.equal(a.state.tables.ContentReview[0][key],originalReview[key]);
assert.equal(a.state.tables.ComplianceIdentity.length,countIdentities);assert.equal(a.state.tables.ContentConsent.length,countConsents);
providerIdentity.expiresAt='2020-01-01T00:00:00Z';response=await update({...input,status:'PUBLISHED'},product.id);assert.equal(response.status,409);assert.match((await response.json()).error,/Content provider:.*expired/);
reset();product=(await (await create(publish)).json()).product;a.state.userId=admin;
response=await update({...input,title:'ADMIN metadata update',description:'Revised commercial description',category:'Updated category',status:'PUBLISHED'},product.id);assert.equal(response.status,200);
assert.equal(a.state.tables.ContentReview[0].fingerprint,a.contentFingerprint(a.state.tables.VideoProduct[0]));assert.equal(a.state.tables.ContentReview[0].providerUserId,owner);
reset();product=(await (await create(publish)).json()).product;a.state.tables.ContentConsent[0].evidenceRef='';response=await update({...input,status:'PUBLISHED'},product.id);assert.equal(response.status,409);assert.match((await response.json()).error,/content-specific consent evidence/);
console.log('PASS: existing provider evidence reused without requiring the publishing actor to become the provider; reviewer decision preserved; ADMIN metadata edits publish immediately; expired provider and missing consent evidence remain blocked.');

// Creator Verification: explicit link, real-review intent and protected evidence, never auto-approval.
reset();a.state.tables.ComplianceIdentity=[];
await assert.rejects(()=>a.complianceAction({action:'creatorLink',performerId:person}),/samePerson/);
await a.complianceAction({action:'creatorLink',performerId:person,samePerson:true});
assert.equal(a.state.tables.ComplianceIdentity.length,0);assert.equal((await a.complianceDashboard()).creator.status,'Action Required');
assert.equal(a.state.tables.Performer.length,1);
const documentId=id(90),documentRef='document:'+documentId;
a.state.tables.PerformerDocument=[{id:documentId,workspaceId:workspace,performerId:person,status:'ACTIVE',title:'Fictional protected evidence',expiresAt:null}];
const creatorIdentity={action:'creatorIdentity',dateOfBirth:'1990-01-01',evidenceRef:documentRef,expiresAt:null,samePerson:true,reviewed:true};
await assert.rejects(()=>a.complianceAction({...creatorIdentity,reviewed:false}));
await assert.rejects(()=>a.complianceAction({...creatorIdentity,evidenceRef:'document:'+id(99)}),/protected document/);
await a.complianceAction(creatorIdentity);assert.equal(a.state.tables.ComplianceIdentity.length,2);
assert.equal((await a.complianceDashboard()).creator.status,'Verified');assert.equal(a.state.tables.Performer.length,1);
product=(await (await create(input)).json()).product;
const creatorReview={action:'creatorReview',productId:product.id,recordedOn:'2025-01-01',reviewed:true};
await assert.rejects(()=>a.complianceAction(creatorReview),/distribution-rights evidence/);
assert.equal(a.state.tables.ContentReview.length,0);
await a.complianceAction({...creatorReview,consentEvidenceRef:documentRef,rightsEvidenceRef:documentRef});
assert.equal(a.state.tables.VideoProduct[0].status,'DRAFT');assert.equal(a.state.tables.ContentReview[0].providerUserId,owner);
const counts=[a.state.tables.ContentReview.length,a.state.tables.ContentConsent.length,a.state.tables.ComplianceIdentity.length];
await a.complianceAction(creatorReview);assert.deepEqual([a.state.tables.ContentReview.length,a.state.tables.ContentConsent.length,a.state.tables.ComplianceIdentity.length],counts);
assert.equal((await update({...input,status:'PUBLISHED'},product.id)).status,200);assert.equal((await a.getPublishedVideos()).length,1);
a.state.tables.ComplianceIdentity[0].expiresAt='2020-01-01T00:00:00Z';assert.equal((await a.complianceDashboard()).creator.status,'Expired');assert.equal((await update({...input,status:'PUBLISHED'},product.id)).status,409);
a.state.tables.ComplianceIdentity[0].expiresAt=null;
a.state.tables.MediaAssetPerformer.push({workspaceId:workspace,mediaAssetId:media,performerId:id(91)});await assert.rejects(()=>a.complianceAction(creatorReview),/other participants/);a.state.tables.MediaAssetPerformer.pop();
a.state.tables.ContentConsent[0].status='REVOKED';await assert.rejects(()=>a.complianceAction(creatorReview),/revoked/);
reset();a.state.userId=operator;await assert.rejects(()=>a.complianceAction({action:'creatorLink',performerId:person,samePerson:true}),/OWNER or ADMIN/);
console.log('PASS: explicit creator link never verifies; protected-document checks and real-review intent required; single form records both identities; consolidated statuses, review/consent reuse, Draft -> Publish -> storefront, expired identity, other participants and revoked consent guards. Isolated fixtures only.');

reset();a.state.tables.ComplianceIdentity=a.state.tables.ComplianceIdentity.filter(row=>row.subjectType==='USER');
await a.complianceAction({action:'creatorLink',performerId:person,samePerson:true});assert.equal((await a.complianceDashboard()).creator.status,'Verified');assert.equal(a.state.tables.ComplianceIdentity.length,2);assert.equal(a.state.tables.ComplianceIdentity[0].evidenceRef,a.state.tables.ComplianceIdentity[1].evidenceRef);
await a.complianceAction({action:'creatorLink',performerId:person,samePerson:true});assert.equal(a.state.tables.ComplianceIdentity.length,2);assert.equal(a.state.tables.Performer.length,1);
reset();a.state.tables.ComplianceIdentity[1].status='REJECTED';await a.complianceAction({action:'creatorLink',performerId:person,samePerson:true});assert.equal((await a.complianceDashboard()).creator.status,'Action Required');assert.equal(a.state.tables.ComplianceIdentity[1].status,'REJECTED');
console.log('PASS: existing reviewed OWNER evidence reused after explicit same-person link without re-entry or duplicate profiles; rejected person evidence is never silently replaced.');

// Creator profile and product association persist in the existing registries.
reset();a.state.tables.Performer=[];a.state.tables.ComplianceIdentity=[];a.state.tables.MediaAssetPerformer=[];
await a.complianceAction({action:'creatorLink',displayName:'Sonia - isolated fixture',samePerson:true});
const profile=a.state.tables.Performer[0];assert.equal((await a.listStorePerformers(workspace))[0].id,profile.id);assert.equal(a.state.tables.ComplianceIdentity.length,0);
const protectedId=id(92),protectedRef='document:'+protectedId;
a.state.tables.PerformerDocument=[{id:protectedId,workspaceId:workspace,performerId:profile.id,status:'ACTIVE',title:'Isolated evidence'}];
await a.complianceAction({action:'creatorIdentity',dateOfBirth:'1990-01-01',evidenceRef:protectedRef,expiresAt:null,samePerson:true,reviewed:true});
response=await create({...input,creatorId:profile.id});assert.equal(response.status,201);product=(await response.json()).product;assert.equal(product.creatorId,profile.id);
assert.equal((await a.listStoreProducts(workspace))[0].creatorId,profile.id);assert(!('creatorId' in a.state.tables.VideoProduct[0]));assert.equal(a.state.tables.ComplianceNote.filter(row=>row.objectType==='PRODUCT_CREATOR').length,1);
await a.complianceAction({action:'creatorReview',productId:product.id,recordedOn:'2025-01-01',consentEvidenceRef:protectedRef,rightsEvidenceRef:protectedRef,reviewed:true});
response=await update({...input,creatorId:profile.id,status:'PUBLISHED'},product.id);assert.equal(response.status,200);assert.equal((await response.json()).product.creatorId,profile.id);assert.equal((await a.getPublishedVideos()).length,1);
const identityCount=a.state.tables.ComplianceIdentity.length,consentCount=a.state.tables.ContentConsent.length;
response=await update({...input,title:'Edited product',status:'DRAFT'},product.id);assert.equal(response.status,200);assert.equal((await response.json()).product.creatorId,profile.id);assert.equal(a.state.tables.VideoProduct[0].complianceStatus,'APPROVED');
const second=await a.db.orm.public.Performer.create({workspaceId:workspace,displayName:'Other fixture person',status:'ACTIVE'});
response=await update({...input,creatorId:second.id,status:'DRAFT'},product.id);assert.equal(response.status,200);assert.equal((await a.listStoreProducts(workspace))[0].creatorId,second.id);assert.equal(a.state.tables.VideoProduct[0].complianceStatus,'DRAFT');assert.equal(a.state.tables.ContentReview[0].status,'DRAFT');
assert.equal(a.state.tables.ComplianceIdentity.length,identityCount);assert.equal(a.state.tables.ContentConsent.length,consentCount);
response=await update({...input,creatorId:second.id,status:'PUBLISHED'},product.id);assert.equal(response.status,409);
response=await update({...input,creatorId:id(777),status:'DRAFT'},product.id);assert.equal(response.status,409);assert.equal((await a.listStoreProducts(workspace))[0].creatorId,second.id);
console.log('PASS: actual creator-profile registration in isolated registry, identity persistence, creatorId response/read-back, approved Publish/storefront, omitted selection retained during edits, creator change invalidates dependent review only, unknown profile denied. No migration.');

const foreignProfile=await a.db.orm.public.Performer.create({workspaceId:id(999),displayName:'Foreign fixture',status:'ACTIVE'});
response=await update({...input,creatorId:foreignProfile.id,status:'DRAFT'},product.id);assert.equal(response.status,409);
const productCount=a.state.tables.VideoProduct.length;a.state.failTable='ComplianceNote';response=await create({...input,creatorId:profile.id,slug:'association-rollback'});assert.equal(response.status,500);assert.equal(a.state.tables.VideoProduct.length,productCount);a.state.failTable=null;
console.log('PASS: foreign-workspace creator denied and association-write failure rolls back the complete product save.');

// Historical records may contain just one side of an explicitly reviewed same-person link.
async function fixtureLink(samePersonReviewed=true,linkWorkspace=workspace){await a.db.orm.public.ComplianceNote.create({workspaceId:linkWorkspace,objectType:'CREATOR_LINK',objectId:owner,actorId:owner,body:JSON.stringify({performerId:person,samePersonReviewed})});}
for(const sourceType of ['USER','PERFORMER']){
reset();await fixtureLink();a.state.tables.ComplianceIdentity=a.state.tables.ComplianceIdentity.filter(row=>row.subjectType===sourceType);
context=await a.ownerPublicationContext(a.db,workspace,owner,{...input,creatorId:person});assert.deepEqual(context.pending,[]);
response=await create({...publish,creatorId:person});assert.equal(response.status,201,JSON.stringify(await response.clone().json()));assert.equal(a.state.tables.ComplianceIdentity.length,1);
assert.equal((await a.complianceDashboard()).creator.status,'Verified');
a.state.tables.ComplianceIdentity[0].status='REJECTED';product=(await response.json()).product;assert.equal((await update({...input,creatorId:person,status:'PUBLISHED'},product.id)).status,409);
}
reset();await fixtureLink();a.state.tables.ComplianceIdentity=[];context=await a.ownerPublicationContext(a.db,workspace,owner,{...input,creatorId:person});assert.equal(context.pending.length,1);assert.match(context.pending[0],/one real identity review/);
for(const scenario of ['no-link','unreviewed-link','foreign-link','expired','conflict','rejected-target','incomplete-target','missing-evidence','underage-recording']){
reset();
if(scenario!=='no-link')await fixtureLink(scenario!=='unreviewed-link',scenario==='foreign-link'?id(999):workspace);
if(['no-link','unreviewed-link','foreign-link','expired','missing-evidence','underage-recording'].includes(scenario))a.state.tables.ComplianceIdentity=a.state.tables.ComplianceIdentity.filter(row=>row.subjectType==='PERFORMER');
if(scenario==='expired')a.state.tables.ComplianceIdentity[0].expiresAt='2020-01-01T00:00:00Z';
if(scenario==='missing-evidence')a.state.tables.ComplianceIdentity[0].evidenceRef='';
if(scenario==='conflict')a.state.tables.ComplianceIdentity[1].dateOfBirth='1991-01-01';
if(scenario==='rejected-target')a.state.tables.ComplianceIdentity[0].status='REJECTED';
if(scenario==='incomplete-target')a.state.tables.ComplianceIdentity[0].status='NOT_VERIFIED';
const payload=scenario==='underage-recording'?{...publish,ownerPublication:{...legal,recordedOn:'2000-01-01'}}:publish;
response=await create({...payload,creatorId:person});assert.equal(response.status,409,scenario);assert.equal(a.state.tables.VideoProduct.length,0);
}
console.log('PASS: single reviewed identity reused bidirectionally through explicit same-person link without writing identity records; missing linked identity reported once; unlinked/different-workspace/unreviewed links, rejection, incomplete evidence, conflicts, expiry and underage-at-recording remain blocked.');
