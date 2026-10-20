// Isolated DB/session fixtures. Real access service, origin validation and R2 signer.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Module from 'node:module';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { fixture } from './fixtures/store-db.mjs';
const id='11111111-1111-4111-8111-111111111111';
const viewFixture=`import React from 'react';export const video={id:'${id}',slug:'synthetic-video',title:'Synthetic video',priceCents:1234,currency:'USD',duration:'1:00',category:'Test',description:'Synthetic only',tags:[],teaser:{source:null}};export async function getPublishedVideo(){return video;}export async function getPublishedVideos(){return [video];}export default function Link({children,...props}){return <a {...props}>{children}</a>;}export function notFound(){throw Error('Not found');}export function Teaser(){return <div>Teaser placeholder</div>;}export function VideoSection(){return null;}export function Watch({label}){return <button>{label}</button>;}`;
const result=await build({stdin:{resolveDir:process.cwd(),contents:`export {POST} from './app/api/account/videos/[id]/watch/route';export {GET as source} from './app/api/media/[id]/thumbnail-source/route';export {default as ProductPage} from './app/(storefront)/videos/[slug]/page';export {default as CheckoutPage} from './app/(storefront)/checkout/[slug]/page';export {listPurchasedVideos} from './src/lib/store/purchases';export {state} from 'fixture';`},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,jsx:'automatic',plugins:[{name:'isolated',setup(b){
 b.onResolve({filter:/(?:prisma\/db$|auth\/session$|^fixture$|^server-only$)/},a=>({path:a.path==='server-only'?'empty':'db',namespace:'fixture'}));
 b.onResolve({filter:/^(?:next\/link|next\/navigation)$|store\/public$|storefront\/(?:StorefrontInteractive|Storefront|WatchFullVideo)$/},a=>({path:a.path.includes('WatchFullVideo')?'watch':'view',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='empty'?'':a.path==='db'?fixture:a.path==='watch'?viewFixture.replace('export default function Link','function Link')+'export default Watch;':viewFixture,loader:'tsx',resolveDir:process.cwd()}));
 b.onResolve({filter:/dotenv/},()=>{throw Error('Production env forbidden');});
}}]});
const m=new Module(process.cwd()+'/scripts/video-tests.memory.cjs');m.filename=m.id;m.paths=Module._nodeModulePaths(process.cwd());m._compile(result.outputFiles[0].text,m.filename);
const {POST,source,ProductPage,CheckoutPage,listPurchasedVideos,state}=m.exports;
Object.assign(process.env,{NODE_ENV:'production',APP_URL:'https://hotwifesonyc.com',R2_ACCOUNT_ID:'test',R2_ACCESS_KEY_ID:'test-key',R2_SECRET_ACCESS_KEY:'test-secret',R2_BUCKET_NAME:'test-bucket',OPERATOR_PREVIEW_MEMBERSHIP_IDS:''});
function seed(role=null,status=null,workspaceId='workspace'){
 state.userId='user';state.tables={Workspace:[{id:'workspace',status:'ACTIVE'}],WorkspaceMember:role?[{id:'membership',userId:'user',workspaceId,role}]:[],VideoProduct:[{id,workspaceId:'workspace',mediaAssetId:'media',title:'Synthetic video'}],MediaAsset:[{id:'media',workspaceId:'workspace',status:'UPLOADED',mediaType:'VIDEO',objectKey:'private/video.mp4',contentType:'video/mp4'}],Purchase:status?[{userId:'user',videoProductId:id,status}]:[]};
}
const invoke=(origin='https://hotwifesonyc.com',extra={},url='http://internal:3000/api/account/videos/id/watch')=>POST(new Request(url,{method:'POST',headers:{origin,'content-type':'application/json',...extra},body:'{}'}),{params:Promise.resolve({id})});
for(const role of ['OWNER','ADMIN','OPERATOR',null])for(const status of [null,'PENDING','PAID','CANCELED','REFUNDED']){
 seed(role,status);const response=await invoke();const allowed=['OWNER','ADMIN'].includes(role)||status==='PAID';assert.equal(response.status,allowed?200:403,`${role}/${status}`);
 if(response.ok){const data=await response.json();assert.deepEqual(Object.keys(data),['url']);const url=new URL(data.url);assert.equal(url.searchParams.get('X-Amz-Expires'),'900');assert.ok(url.searchParams.get('X-Amz-Signature'));assert.match(response.headers.get('cache-control'),/private, no-store/);}
 else assert.equal((await response.json()).error,'This Video Is Locked. Purchase this video to unlock the full content.');
 const html=renderToStaticMarkup(await ProductPage({params:Promise.resolve({slug:'synthetic-video'})}));assert.equal(html.includes('Watch Video'),allowed);assert.equal(html.includes('Buy This Video'),!allowed);assert.equal(html.includes('Checkout coming soon'),!allowed);assert(!html.includes('X-Amz-Signature'));
}
seed('OPERATOR');process.env.OPERATOR_PREVIEW_MEMBERSHIP_IDS='membership';assert.equal((await invoke()).status,200);process.env.OPERATOR_PREVIEW_MEMBERSHIP_IDS='';
for(const role of ['OWNER','ADMIN','OPERATOR']){seed(role,null,'foreign-workspace');assert.equal((await invoke()).status,403);}
seed('ADMIN');state.tables.Workspace[0].status='INACTIVE';assert.equal((await invoke()).status,404);
seed(null,'PAID');assert.equal((await listPurchasedVideos()).length,1);state.tables.Purchase[0].status='REFUNDED';assert.equal((await listPurchasedVideos()).length,0);
seed();state.userId=null;assert.equal((await invoke()).status,401);const anonymous=renderToStaticMarkup(await ProductPage({params:Promise.resolve({slug:'synthetic-video'})}));assert.match(anonymous,/Sign In/);assert.match(anonymous,/Create Account/);assert(!anonymous.includes('Watch Video'));
seed('OWNER');for(const origin of ['https://hotwifesonyc.com','https://www.hotwifesonyc.com'])assert.equal((await invoke(origin,{'x-forwarded-host':new URL(origin).host,'x-forwarded-proto':'https'})).status,200);
for(const origin of ['https://evil.test','http://hotwifesonyc.com','https://hotwifesonyc.com.evil.test'])assert.equal((await invoke(origin,{'x-forwarded-host':'evil.test','x-forwarded-proto':'https'})).status,403);
assert.equal((await invoke('https://hotwifesonyc.com',{'sec-fetch-site':'cross-site'})).status,403);assert.equal((await invoke('https://hotwifesonyc.com',{'content-type':'text/plain'})).status,415);
process.env.APP_URL='';assert.equal((await invoke()).status,403);process.env.APP_URL='https://hotwifesonyc.com';
seed('OPERATOR');assert.equal((await source(new Request('https://hotwifesonyc.com/api/media/media/thumbnail-source'),{params:Promise.resolve({id:'media'})})).status,403);
seed('MEMBER');assert.equal((await source(new Request('https://hotwifesonyc.com/api/media/media/thumbnail-source'),{params:Promise.resolve({id:'media'})})).status,403);
const before=JSON.stringify(state.tables.Purchase);const checkout=renderToStaticMarkup(await CheckoutPage({params:Promise.resolve({slug:'synthetic-video'})}));assert.match(checkout,/disabled/);assert.equal(JSON.stringify(state.tables.Purchase),before);
const player=fs.readFileSync('components/storefront/VideoModal.tsx','utf8');assert.match(player,/controlsList="nodownload"/);assert.doesNotMatch(player,/<a[^>]*download/);
console.log('PASS: OWNER/ADMIN workspace scope; OPERATOR denied by default, explicit grant allowed; paid/pending/refunded/canceled customers; anonymous sign-in/register; product-page access state and My Videos registry; private 900s signatures only after authorization; checkout cannot grant access; thumbnail-source bypass denied.');
console.log('PASS: internal proxy URL with canonical/www public origins; hostile origin, forged proxy, cross-site, wrong content type and missing production APP_URL denied. No .env, database or network accessed.');
