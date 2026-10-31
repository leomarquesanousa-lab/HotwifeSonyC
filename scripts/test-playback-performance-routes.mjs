// Isolated route/security regression: in-memory DB, synthetic bytes, no .env or R2.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import Module from 'node:module';
import {fixture} from './fixtures/store-db.mjs';
const trackedFixture=fixture.replace('async all(){return',`async all(){state.active=(state.active||0)+1;state.maxActive=Math.max(state.maxActive||0,state.active);await new Promise(r=>setTimeout(r,5));state.active--;return`);
const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`export {GET as source} from './app/api/media/[id]/thumbnail-source/route';export {GET as publicRoute} from './app/api/storefront/videos/[slug]/[kind]/route';export {resolvePublicMedia} from './src/lib/store/public';export {state} from 'fixture';`},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'isolate',setup(b){
 b.onResolve({filter:/(?:prisma\/db$|auth\/session$|^fixture$|^server-only$|storage\/r2$)/},a=>({path:a.path==='server-only'?'empty':a.path.endsWith('storage/r2')?'storage':'db',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='empty'?'':a.path==='storage'?`import {state} from 'fixture';export async function getR2ObjectDownloadUrl(){state.signs=(state.signs||0)+1;return 'https://synthetic.invalid/bytes';}`:trackedFixture}));
 b.onResolve({filter:/dotenv/},()=>{throw Error('Production env forbidden');});
}}]});
const m=new Module(process.cwd()+'/scripts/performance.memory.cjs');m.filename=m.id;m.paths=Module._nodeModulePaths(process.cwd());m._compile(bundle.outputFiles[0].text,m.filename);
const {source,publicRoute,resolvePublicMedia,state}=m.exports;
function seed(){state.userId='user';state.maxActive=state.active=state.signs=0;state.tables={Workspace:[{id:'ws',status:'ACTIVE'}],WorkspaceMember:[{id:'membership',userId:'user',workspaceId:'ws',role:'OWNER'}],VideoProduct:[{id:'product',slug:'synthetic',status:'PUBLISHED',publishedAt:'2020-01-01',workspaceId:'ws',mediaAssetId:'full',teaserMediaAssetId:'teaser',thumbnailMediaAssetId:'cover'}],MediaAsset:[{id:'full',workspaceId:'ws',status:'UPLOADED',mediaType:'VIDEO',contentType:'video/mp4',objectKey:'full-key',thumbnailObjectKey:'generated-image'},{id:'teaser',workspaceId:'ws',status:'UPLOADED',mediaType:'VIDEO',contentType:'video/mp4',objectKey:'teaser-key'},{id:'cover',workspaceId:'ws',status:'UPLOADED',mediaType:'IMAGE',contentType:'image/jpeg',objectKey:'cover-key'}]};}
let calls=0,nextStatus=206,range,signal,withBody=true,acceptRanges=true;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{assert.equal(url,'https://synthetic.invalid/bytes');calls++;range=options.headers?.Range;signal=options.signal;return new Response(withBody?new Uint8Array(nextStatus===416?0:64):null,{status:nextStatus,headers:{...(acceptRanges?{'accept-ranges':'bytes'}:{}),...(nextStatus===206?{'content-range':'bytes 0-63/1024','content-length':'64'}:nextStatus===416?{'content-range':'bytes */1024','content-length':'0'}:{})}});};
const invoke=(handler,headers={range:'bytes=0-63'})=>{const request=new Request('https://app.invalid',{headers});return {request,promise:handler(request,{params:Promise.resolve({id:'full',slug:'synthetic',kind:'teaser'})})};};
try{
 for(const handler of [source,publicRoute])for(const status of [200,206,416])for(const body of status===416?[true,false]:[true]){
  seed();nextStatus=status;withBody=body;const {request,promise}=invoke(handler);const response=await promise;
  assert.equal(response.status,status);assert.equal(range,'bytes=0-63');assert.equal(signal,request.signal);assert.equal(response.headers.get('accept-ranges'),'bytes');assert.match(response.headers.get('cache-control'),/private, no-store/);
  if(status===206)assert.equal(response.headers.get('content-range'),'bytes 0-63/1024');if(status===416)assert.equal(response.headers.get('content-range'),'bytes */1024');
  await response.arrayBuffer();
 }
 seed();nextStatus=206;withBody=true;acceptRanges=false;assert.equal((await invoke(source).promise).headers.get('accept-ranges'),null);acceptRanges=true;
 seed();nextStatus=503;assert.equal((await invoke(source).promise).status,502);nextStatus=200;withBody=false;assert.equal((await invoke(source).promise).status,502);withBody=true;
 for(const [change,status] of [
  [()=>state.userId=null,401],
  [()=>state.tables.WorkspaceMember=[],404],
  [()=>state.tables.WorkspaceMember[0].role='OPERATOR',403],
  [()=>state.tables.Workspace[0].status='INACTIVE',403],
  [()=>state.tables.MediaAsset[0].workspaceId='foreign',404],
  [()=>state.tables.MediaAsset[0].status='UPLOADING',409],
 ]){seed();change();const before=calls;assert.equal((await invoke(source).promise).status,status);assert.equal(calls,before);assert.equal(state.signs,0);}
 seed();assert.deepEqual(await resolvePublicMedia('synthetic','teaser'),{objectKey:'teaser-key',contentType:'video/mp4'});assert.equal(state.maxActive,4);
 seed();assert.deepEqual(await resolvePublicMedia('synthetic','thumbnail'),{objectKey:'cover-key',contentType:'image/jpeg'});
 for(const change of [
 ()=>state.tables.VideoProduct[0].status='DRAFT',
 ()=>state.tables.VideoProduct[0].publishedAt='2099-01-01',
 ...['REJECTED','SUSPENDED','REMOVED'].map(status=>()=>state.tables.VideoProduct[0].complianceStatus=status),
 ()=>state.tables.Workspace[0].status='INACTIVE',
 ()=>state.tables.MediaAsset[0].workspaceId='foreign',
 ()=>state.tables.MediaAsset[0].status='UPLOADING',
 ()=>state.tables.MediaAsset[0].mediaType='IMAGE',
 ()=>state.tables.MediaAsset[1].workspaceId='foreign',
 ()=>state.tables.MediaAsset[1].status='UPLOADING',
 ()=>state.tables.MediaAsset[1].contentType='text/plain',
 ()=>state.tables.VideoProduct[0].teaserMediaAssetId='full',
 ()=>state.tables.VideoProduct.push({id:'other',mediaAssetId:'teaser'}),
 ]){seed();change();assert.equal(await resolvePublicMedia('synthetic','teaser'),null);}
 seed();state.tables.VideoProduct[0].thumbnailMediaAssetId=null;assert.deepEqual(await resolvePublicMedia('synthetic','thumbnail'),{objectKey:'generated-image',contentType:'image/jpeg'});state.tables.MediaAsset.push({objectKey:'generated-image',mediaType:'VIDEO',contentType:'video/mp4'});assert.equal(await resolvePublicMedia('synthetic','thumbnail'),null);
 console.log('PASS: 200/206/416 including empty 416, Content-Range/length, forwarded Range and AbortSignal, private cache headers, no invented Accept-Ranges, upstream failures, all authorization gates before signing/fetch.');
 console.log('PASS: parallel public-media reads (4 concurrent after product lookup), publication/safety/workspace/type/status/protected-full checks and safe thumbnail fallback preserved. Synthetic fixtures only.');
}finally{globalThis.fetch=originalFetch;}
