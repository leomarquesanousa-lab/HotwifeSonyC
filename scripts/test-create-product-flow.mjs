// Local integration test. No .env loader, real database client, storage client or external requests.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Module from 'node:module';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { fixture } from './fixtures/store-db.mjs';
const root = process.cwd();
const id = n => `55555555-5555-4555-8555-${String(n).padStart(12,'0')}`;
const workspace = id(1), owner = id(2), person = id(3);
const backend = await build({ stdin: { resolveDir: root, contents: `export {GET as list,POST as create} from './app/api/store/products/route';export {PUT as update} from './app/api/store/products/[id]/route';export {POST as check} from './app/api/store/products/compliance/route';export {GET as reviewList,POST as approve} from './app/api/admin/compliance/route';export {getPublishedVideos,resolvePublicMedia} from './src/lib/store/public';export {contentFingerprint,mediaFingerprint} from './src/lib/compliance/service';export {state,db} from 'fixture';` }, bundle:true, platform:'node', format:'cjs', packages:'external', write:false, plugins:[{name:'isolated-db',setup(b){
 b.onResolve({filter:/(?:prisma\/db$|auth\/session$|^\.\/session$|^fixture$|^server-only$)/},a=>({path:a.path==='server-only'?'empty':'fixture',namespace:'memory'}));
 b.onLoad({filter:/.*/,namespace:'memory'},a=>({contents:a.path==='empty'?'':fixture,loader:'js'}));
 b.onResolve({filter:/(@aws-sdk|dotenv|storage\/|r2-client)/},a=>{throw Error('Forbidden production dependency: '+a.path);});
}}] });
const mod = new Module(root+'/scripts/flow.memory.cjs');mod.filename=root+'/scripts/flow.memory.cjs';mod.paths=Module._nodeModulePaths(root);mod._compile(backend.outputFiles[0].text,mod.filename);const api=mod.exports;
api.state.userId=owner;
Object.assign(api.state.tables,{Workspace:[{id:workspace,status:'ACTIVE'}],WorkspaceMember:[{workspaceId:workspace,userId:owner,role:'OWNER'}],User:[{id:owner,status:'ACTIVE'}],Performer:[{id:person,workspaceId:workspace,status:'ACTIVE',displayName:'Fictional participant'}],ComplianceIdentity:['USER','PERFORMER'].map((subjectType,i)=>({id:id(10+i),workspaceId:workspace,subjectType,subjectId:i?person:owner,status:'VERIFIED',dateOfBirth:'1990-01-01',evidenceRef:'test-vault:identity-'+i,expiresAt:null,createdAt:'2025-01-01'}))});
api.state.tables.Performer.unshift({id:id(30),workspaceId:workspace,status:'ACTIVE',displayName:'Additional fictional profile'});
api.state.tables.ComplianceNote=[{id:id(31),workspaceId:workspace,objectType:'CREATOR_LINK',objectId:owner,body:JSON.stringify({performerId:person,samePersonReviewed:true}),createdAt:'2025-01-01'}];
api.state.tables.PerformerDocument=[{id:id(32),workspaceId:workspace,performerId:person,status:'ACTIVE',documentType:'RELEASE_FORM',title:'Synthetic consent and rights',expiresAt:null}];
const client = await build({stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import{createRoot}from'react-dom/client';import StoreVideos from './src/components/store/StoreVideos';import{UploadManagerProvider}from './src/components/app/UploadManagerProvider';import{VideoCard}from './components/storefront/Storefront';async function main(){const data=await(await fetch('/test/bootstrap')).json();createRoot(document.getElementById('root')).render(location.pathname==='/videos'?<>{data.videos.map(v=><VideoCard key={v.id} video={v}/>)}</>:<UploadManagerProvider><StoreVideos initialProducts={data.products} media={data.media} creators={data.creators}/></UploadManagerProvider>);}main();`},bundle:true,jsx:'automatic',write:false,plugins:[{name:'browser-isolation',setup(b){
 b.onResolve({filter:/next\/link$|next-intl$|WatchFullVideo$|LegalFooter$|AccountMenu$|read-video-metadata$/},a=>({path:a.path,namespace:'ui-fixture'}));
 b.onLoad({filter:/.*/,namespace:'ui-fixture'},a=>({contents:a.path==='next-intl'?`export const useTranslations=()=>key=>key;`:a.path.endsWith('read-video-metadata')?`export const readVideoMetadata=async()=>({durationSeconds:2,width:16,height:16});`:a.path==='next/link'?`import React from 'react';export default function Link(p){return React.createElement('a',p);}`:`export default function Placeholder(){return null;}`,loader:'js',resolveDir:root}));
}}]});
let serial=100;const uploads=new Map();const requests=[];
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');requests.push({path:url.pathname,method:req.method});
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(url.pathname==='/bundle.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(client.outputFiles[0].text);return;}
 if(url.pathname==='/test/bootstrap'){json({products:(await(await api.list()).json()).products,media:api.state.tables.MediaAsset??[],creators:(await(await api.list()).json()).creators,videos:await api.getPublishedVideos()});return;}
 if(url.pathname.startsWith('/api/storefront/')||url.pathname.endsWith('/thumbnail')){res.writeHead(204);res.end();return;}
 if(req.method==='GET'&&!url.pathname.startsWith('/api/')){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');return;}
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks);const body=bytes.toString();
 if(url.pathname.startsWith('/test/upload/')){const mediaId=url.pathname.split('/').pop();uploads.get(mediaId).bytes=bytes;res.writeHead(200,{ETag:'"test-etag"'});res.end();return;}
 const data=body?JSON.parse(body):{};
 if(url.pathname==='/api/media/multipart/start'){
  assert.equal(data.source,'STORE_PRODUCT');assert(data.fileSize>0);const mediaId=id(serial++);uploads.set(mediaId,{...data,bytes:null});
  await api.db.orm.public.MediaAsset.create({id:mediaId,workspaceId:workspace,status:'UPLOADING',mediaType:data.contentType.startsWith('video/')?'VIDEO':'IMAGE',contentType:data.contentType,originalFileName:data.fileName,durationSeconds:data.videoMetadata?.durationSeconds??null,objectKey:'test-only/'+mediaId});
  json({success:true,mediaId,uploadId:'test-upload-'+mediaId});return;
 }
 if(url.pathname==='/api/media/multipart/part-url'){assert(uploads.has(data.mediaId));json({success:true,uploadUrl:'http://127.0.0.1:'+server.address().port+'/test/upload/'+data.mediaId});return;}
 if(url.pathname==='/api/media/multipart/complete'){
  const upload=uploads.get(data.mediaId);assert.equal(upload.bytes.length,upload.fileSize);assert.equal(data.parts.length,1);
  await api.db.orm.public.MediaAsset.where({id:data.mediaId}).updateAndCount({status:'UPLOADED'});
  json({success:true});return;
 }
 const request=new Request('http://127.0.0.1:'+server.address().port+url.pathname,{method:req.method,headers:req.headers,body:req.method==='GET'?undefined:body});
 let response;
 if(url.pathname==='/api/admin/compliance')response=req.method==='GET'?await api.reviewList(request):await api.approve(request);
 else if(url.pathname==='/api/store/products/compliance')response=await api.check(request);
 else if(url.pathname==='/api/store/products')response=req.method==='GET'?await api.list():await api.create(request);
 else if(/^\/api\/store\/products\/[^/]+$/.test(url.pathname))response=await api.update(request,{params:Promise.resolve({id:url.pathname.split('/').pop()})});
 else {json({error:'Unexpected request'},404);return;}
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
}catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:String(error)}));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;const blocked=[];const browserErrors=[];
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext();
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){blocked.push(route.request().url());return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',error=>browserErrors.push(error.message));await page.goto(origin);
 async function uploadSet(suffix=''){
  for(const [label,name,type] of [['Full Video','full'+suffix+'.mp4','video/mp4'],['Teaser','teaser'+suffix+'.mp4','video/mp4'],['Cover Image','cover'+suffix+'.png','image/png']]){
   await page.getByLabel(label,{exact:true}).setInputFiles({name,mimeType:type,buffer:Buffer.from('synthetic-only:'+name)});await page.waitForFunction(()=>!document.querySelector('fieldset').disabled);
  }
 }
 async function assertOperationalOnly(){
  for(const label of ['Creator','Creator profile','Date of birth','Recording date','Description','Category','Slug','Protected identity evidence reference','Protected consent reference'])assert.equal(await page.getByLabel(label,{exact:true}).count(),0,label);
  assert.equal(await page.locator('form').count(),1);assert.equal(await page.getByRole('button',{name:'Save Draft',exact:true}).count(),0);assert.equal(await page.getByRole('form',{name:'Publication requirements'}).count(),0);
 }
 await page.getByRole('button',{name:'New Video',exact:true}).click();await assertOperationalOnly();assert.equal(await page.getByRole('button',{name:'Publish for Sale',exact:true}).isDisabled(),true);
 await uploadSet();assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'full');await page.getByLabel('Title',{exact:true}).fill('Synthetic direct publication');await page.getByLabel('Price (USD)',{exact:true}).fill('9.99');
 assert.equal(uploads.size,3);assert([...uploads.values()].every(item=>!item.productCreatorId));assert.equal(await page.getByRole('button',{name:'Publish for Sale',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'Publish for Sale',exact:true}).click();await page.getByRole('alert').filter({hasText:'Publication pending:'}).waitFor();assert.match(await page.getByRole('alert').textContent(),/recording date.*identified depicted participants/);await assertOperationalOnly();
 let product=(await(await api.list()).json()).products[0];assert.equal(product.status,'DRAFT');assert.equal(product.creatorId,null);assert.equal(product.priceCents,999);assert.equal(api.state.tables.ContentConsent?.length??0,0);assert.equal(api.state.tables.ContentReview?.length??0,0);assert.equal(await page.getByLabel('Price (USD)',{exact:true}).inputValue(),'9.99');
 console.log('PASS: select/upload three synthetic files -> title/price -> Publish; missing proof blocks precisely and preserves the automatically saved draft, without actor/creator/document forms.');
 // Isolated administrative registry supplies explicitly reviewed test evidence.
 // This call is separate from the video editor and never touches production.
 const approval=await api.approve(new Request(origin+'/api/admin/compliance',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'publicationReview',productId:product.id,recordedOn:'2025-01-01',reviewed:true,rightsEvidenceRef:'document:'+id(32),people:[{performerId:person,consentEvidenceRef:'document:'+id(32)}]})}));assert.equal(approval.status,200,await approval.text());
 const evidence=structuredClone({identities:api.state.tables.ComplianceIdentity,consents:api.state.tables.ContentConsent,documents:api.state.tables.PerformerDocument,reviews:api.state.tables.ContentReview});
 await page.getByRole('button',{name:'Publish for Sale',exact:true}).click();await page.getByRole('status').filter({hasText:'Published in the catalog.'}).waitFor();product=api.state.tables.VideoProduct[0];assert.equal(product.status,'PUBLISHED');assert.equal(product.priceCents,999);assert.equal((await api.getPublishedVideos()).length,1);assert.equal(await api.resolvePublicMedia(product.slug,'full'),null);await page.getByText('PUBLISHED',{exact:true}).waitFor();
 assert.deepEqual({identities:api.state.tables.ComplianceIdentity,consents:api.state.tables.ContentConsent,documents:api.state.tables.PerformerDocument,reviews:api.state.tables.ContentReview},evidence);
 await page.reload();await page.getByRole('button',{name:'Edit',exact:true}).click();await assertOperationalOnly();await page.getByLabel('Price (USD)',{exact:true}).fill('10.99');await page.getByRole('button',{name:'Publish for Sale',exact:true}).click();await page.getByRole('status').filter({hasText:'Published in the catalog.'}).waitFor();assert.equal(api.state.tables.VideoProduct[0].priceCents,1099);
 assert.deepEqual({identities:api.state.tables.ComplianceIdentity,consents:api.state.tables.ContentConsent,documents:api.state.tables.PerformerDocument,reviews:api.state.tables.ContentReview},evidence);
 console.log('PASS: evidence already associated -> direct Publish at USD 9.99 -> API persisted state -> gallery/catalog; reload and price change publish without new approval, consent or documents.');
 await page.goto(origin+'/videos');await page.getByRole('heading',{name:product.title,exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'View details for '+product.title}).getAttribute('href'),'/videos/'+product.slug);
 await page.goto(origin);await page.getByRole('button',{name:'New Video',exact:true}).click();await uploadSet('2');await page.getByLabel('Price (USD)',{exact:true}).fill('5.99');await page.getByRole('button',{name:'Publish for Sale',exact:true}).click();await page.getByRole('alert').filter({hasText:'Publication pending:'}).waitFor();await page.getByRole('button',{name:'Publish for Sale',exact:true}).click();await page.getByRole('alert').filter({hasText:'Publication pending:'}).waitFor();assert.equal(api.state.tables.VideoProduct.length,2);assert.equal(api.state.tables.VideoProduct.filter(item=>item.status==='DRAFT').length,1);assert.equal(api.state.tables.VideoProduct[0].status,'PUBLISHED');assert.equal(api.state.tables.ContentConsent.length,1);
 assert.equal(requests.filter(item=>item.path==='/api/admin/compliance'||item.path==='/api/store/products/compliance').length,0);assert.deepEqual(blocked,[]);assert.deepEqual(browserErrors,[]);
 console.log('PASS: a second unproven upload remains blocked; retries do not duplicate drafts or modify the first video; editor makes zero compliance API calls. All browser requests stayed on loopback; DB/storage simulated.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}