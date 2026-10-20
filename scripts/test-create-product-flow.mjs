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
const backend = await build({ stdin: { resolveDir: root, contents: `export {GET as list,POST as create} from './app/api/store/products/route';export {PUT as update} from './app/api/store/products/[id]/route';export {POST as check} from './app/api/store/products/compliance/route';export {getPublishedVideos,resolvePublicMedia} from './src/lib/store/public';export {contentFingerprint,mediaFingerprint} from './src/lib/compliance/service';export {state,db} from 'fixture';` }, bundle:true, platform:'node', format:'cjs', packages:'external', write:false, plugins:[{name:'isolated-db',setup(b){
 b.onResolve({filter:/(?:prisma\/db$|auth\/session$|^\.\/session$|^fixture$|^server-only$)/},a=>({path:a.path==='server-only'?'empty':'fixture',namespace:'memory'}));
 b.onLoad({filter:/.*/,namespace:'memory'},a=>({contents:a.path==='empty'?'':fixture,loader:'js'}));
 b.onResolve({filter:/(@aws-sdk|dotenv|storage\/|r2-client)/},a=>{throw Error('Forbidden production dependency: '+a.path);});
}}] });
const mod = new Module(root+'/scripts/flow.memory.cjs');mod.filename=root+'/scripts/flow.memory.cjs';mod.paths=Module._nodeModulePaths(root);mod._compile(backend.outputFiles[0].text,mod.filename);const api=mod.exports;
api.state.userId=owner;
Object.assign(api.state.tables,{Workspace:[{id:workspace,status:'ACTIVE'}],WorkspaceMember:[{workspaceId:workspace,userId:owner,role:'OWNER'}],User:[{id:owner,status:'ACTIVE'}],Performer:[{id:person,workspaceId:workspace,status:'ACTIVE',displayName:'Fictional participant'}],ComplianceIdentity:['USER','PERFORMER'].map((subjectType,i)=>({id:id(10+i),workspaceId:workspace,subjectType,subjectId:i?person:owner,status:'VERIFIED',dateOfBirth:'1990-01-01',evidenceRef:'test-vault:identity-'+i,expiresAt:null,createdAt:'2025-01-01'}))});
const client = await build({stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import{createRoot}from'react-dom/client';import StoreVideos from './src/components/store/StoreVideos';import{UploadManagerProvider}from './src/components/app/UploadManagerProvider';import{VideoCard}from './components/storefront/Storefront';async function main(){const data=await(await fetch('/test/bootstrap')).json();createRoot(document.getElementById('root')).render(location.pathname==='/videos'?<>{data.videos.map(v=><VideoCard key={v.id} video={v}/>)}</>:<UploadManagerProvider><StoreVideos initialProducts={data.products} media={data.media}/></UploadManagerProvider>);}main();`},bundle:true,jsx:'automatic',write:false,plugins:[{name:'browser-isolation',setup(b){
 b.onResolve({filter:/next\/link$|next-intl$|WatchFullVideo$|LegalFooter$|read-video-metadata$/},a=>({path:a.path,namespace:'ui-fixture'}));
 b.onLoad({filter:/.*/,namespace:'ui-fixture'},a=>({contents:a.path==='next-intl'?`export const useTranslations=()=>key=>key;`:a.path.endsWith('read-video-metadata')?`export const readVideoMetadata=async()=>({durationSeconds:2,width:16,height:16});`:a.path==='next/link'?`import React from 'react';export default function Link(p){return React.createElement('a',p);}`:`export default function Placeholder(){return null;}`,loader:'js',resolveDir:root}));
}}]});
let serial=100;const uploads=new Map();const requests=[];
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');requests.push({path:url.pathname,method:req.method});
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(url.pathname==='/bundle.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(client.outputFiles[0].text);return;}
 if(url.pathname==='/test/bootstrap'){json({products:(await(await api.list()).json()).products,media:api.state.tables.MediaAsset??[],videos:await api.getPublishedVideos()});return;}
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
  await api.db.orm.public.MediaAssetPerformer.create({workspaceId:workspace,mediaAssetId:data.mediaId,performerId:person});json({success:true});return;
 }
 const request=new Request('http://127.0.0.1:'+server.address().port+url.pathname,{method:req.method,headers:req.headers,body:req.method==='GET'?undefined:body});
 let response;
 if(url.pathname==='/api/store/products/compliance')response=await api.check(request);
 else if(url.pathname==='/api/store/products')response=req.method==='GET'?await api.list():await api.create(request);
 else if(/^\/api\/store\/products\/[^/]+$/.test(url.pathname))response=await api.update(request,{params:Promise.resolve({id:url.pathname.split('/').pop()})});
 else {json({error:'Unexpected request'},404);return;}
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
}catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:String(error)}));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;const blocked=[];const browserErrors=[];
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext();
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin){blocked.push(url.origin);return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',error=>browserErrors.push(error.message));await page.goto(origin);
 await page.getByRole('button',{name:'Create Product',exact:true}).click();
 const title='Vídeo fictício - teste local';await page.getByLabel('Title',{exact:true}).fill(title);await page.getByLabel('Description',{exact:true}).fill('Produto fictício com mídia sintética, sem conteúdo adulto.');await page.getByLabel('Price (USD)',{exact:true}).fill('12.34');await page.getByLabel('Category',{exact:true}).fill('Local test');
 assert.equal(await page.getByLabel('Slug',{exact:true}).inputValue(),'video-ficticio-teste-local');
 for(const [label,name,type] of [['Full Video','full.mp4','video/mp4'],['Teaser (optional)','teaser.mp4','video/mp4'],['Cover Image (optional)','cover.png','image/png']]){
  await page.getByLabel(label,{exact:true}).setInputFiles({name,mimeType:type,buffer:Buffer.from('synthetic-test-bytes:'+name)});
  await page.getByRole('button',{name:'Save Draft',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('fieldset').disabled);
 }
 assert.equal(uploads.size,3);assert.equal(api.state.tables.MediaAsset.filter(m=>m.status==='UPLOADED').length,3);console.log('PASS: title, generated slug, description, category, price and three multipart uploads using real UploadManager with local storage mocks.');
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();await page.getByRole('status').filter({hasText:'Product saved.'}).waitFor();
 let product=api.state.tables.VideoProduct[0];assert.equal(product.status,'DRAFT');assert.equal(product.priceCents,1234);assert.equal(new Set([product.mediaAssetId,product.teaserMediaAssetId,product.thumbnailMediaAssetId]).size,3);for(const [field,name] of [['mediaAssetId','full.mp4'],['teaserMediaAssetId','teaser.mp4'],['thumbnailMediaAssetId','cover.png']])assert.equal(api.state.tables.MediaAsset.find(m=>m.id===product[field]).originalFileName,name);assert.equal((await api.getPublishedVideos()).length,0);
 await page.reload();await page.getByRole('button',{name:'Edit',exact:true}).click();assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),title);assert.equal(await page.getByLabel('Price (USD)',{exact:true}).inputValue(),'12.34');console.log('PASS: Save Draft, API persistence in isolated memory, correct media associations, reload and recovery for editing.');
 // Assert absence in the real rendered form, including every replacement introduced previously.
 for(const text of ['Complete legal checks here for direct publication','Publication compliance','Missing recording date','Missing consent evidence reference','By clicking Publish, I confirm','Depicted participants']) assert.equal(await page.getByText(text,{exact:false}).count(),0);
 assert.equal(await page.locator('form input[type="checkbox"]').count(),1); // Featured only.
 assert.equal(await page.getByLabel('Status',{exact:true}).count(),1);
 const callsBefore=requests.filter(r=>r.path==='/api/store/products/compliance').length;
 await page.getByRole('button',{name:'Publish',exact:true}).first().click();await page.getByRole('alert').filter({hasText:'Publication pending:'}).waitFor();
 assert.match(await page.getByRole('alert').textContent(),/recording date.*content-specific consent.*distribution rights/);
 assert.equal(api.state.tables.VideoProduct[0].status,'DRAFT');assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),title);
 assert.equal(api.state.tables.ContentConsent?.length??0,0);
 console.log('PASS: legal section and replacement questionnaire absent; incomplete Publish rejected by real backend with specific pending records; form retained.');
 // Existing verified records, as supplied by the separate compliance registry.
 product=api.state.tables.VideoProduct[0];
 await api.db.orm.public.ContentConsent.create({workspaceId:workspace,videoProductId:product.id,performerId:person,status:'RECORDED',evidenceRef:'test-vault:release',mediaFingerprint:api.mediaFingerprint(product),depiction:true,distribution:true,publication:true,downloads:false,recordedAt:'2025-01-01'});
 await api.db.orm.public.ContentReview.create({workspaceId:workspace,videoProductId:product.id,status:'APPROVED',fingerprint:api.contentFingerprint(product),providerUserId:owner,recordedOn:'2025-01-01',allPersonsConfirmed:true,prohibitedChecked:true,copyrightConfirmed:true});
 await api.db.orm.public.VideoProduct.where({id:product.id}).updateAndCount({complianceStatus:'APPROVED'});
 await page.getByRole('button',{name:'Publish',exact:true}).first().click();await page.getByRole('status').filter({hasText:'Product saved.'}).waitFor();
 product=api.state.tables.VideoProduct[0];assert.equal(product.status,'PUBLISHED');assert.equal(product.complianceStatus,'APPROVED');assert.equal(api.state.tables.ContentConsent.length,1);
 const catalog=await api.getPublishedVideos();assert.equal(catalog.length,1);assert.equal(await api.resolvePublicMedia(product.slug,'full'),null);
 await page.reload();await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Title',{exact:true}).fill(title+' revised');
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();await page.getByRole('status').filter({hasText:'Product saved.'}).waitFor();
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('button',{name:'Publish',exact:true}).first().click();await page.getByRole('status').filter({hasText:'Product saved.'}).waitFor();assert.equal(api.state.tables.ContentConsent.length,1);
 assert.equal(requests.filter(r=>r.path==='/api/store/products/compliance').length,callsBefore);console.log('PASS: Publish reuses valid backend records, metadata edit -> Draft -> Publish requires no repeated intake and no automatic compliance requests.');
 await page.goto(origin+'/videos');await page.getByRole('heading',{name:title+' revised',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'View details for '+title+' revised'}).getAttribute('href'),'/videos/'+product.slug);assert.equal(await page.getByAltText('Artwork for '+title+' revised').getAttribute('src'),catalog[0].thumbnail);console.log('PASS: actual storefront VideoCard renders the published product using the real catalog service.');
 assert.deepEqual(blocked,[]);assert.deepEqual(browserErrors,[]);assert.equal([...uploads.values()].reduce((n,u)=>n+u.bytes.length,0),[...uploads.values()].reduce((n,u)=>n+u.fileSize,0));console.log('PASS: no browser runtime errors; all requests stayed on loopback; production DB/storage imports blocked; no R2 upload.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
