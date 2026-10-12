// Isolated R2/auth fixtures; no .env, database or remote storage access.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Module from 'node:module';
const fixture = `
export const state={objects:new Map(),revision:0,role:'OWNER'};
export class GetObjectCommand{constructor(input){this.input=input;this.get=true;}}
export class PutObjectCommand{constructor(input){this.input=input;}}
export function getR2BucketName(){return 'fixture';}
export function getR2Client(){return {async send(command){const i=command.input,old=state.objects.get(i.Key);if(command.get){if(!old)throw {$metadata:{httpStatusCode:404}};return {ETag:old.version,ContentType:old.type,Body:{transformToString:async()=>String(old.body),transformToByteArray:async()=>new Uint8Array(old.body)}};}if((i.IfMatch&&old?.version!==i.IfMatch)||(i.IfNoneMatch&&old))throw {$metadata:{httpStatusCode:412}};state.objects.set(i.Key,{body:i.Body,type:i.ContentType,version:String(++state.revision)});return {};}};}
export async function requireStoreManagementAccess(){if(!state.role)throw {status:401};return {canDelete:['OWNER','ADMIN'].includes(state.role)};}
export function storeFailure(error){return Response.json({error:'Unable to save banners.'},{status:error.status??500});}
`;
const bundle=await build({stdin:{contents:`export * from './app/api/admin/homepage-banners/route';export {GET as imageGET} from './app/api/homepage-banners/image/route';export {bannerStore} from './src/lib/homepage-banners/server';export {publicBanners} from './src/lib/homepage-banners/types';export {state} from 'fixture';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/^fixture$|^server-only$|@aws-sdk\/client-s3|storage\/r2$|store\/admin$/},a=>({path:a.path==='server-only'?'empty':'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='empty'?'':fixture,loader:'js'}));}}]});
const m=new Module(process.cwd()+'/scripts/banner-tests.memory.cjs');m.filename=process.cwd()+'/scripts/banner-tests.memory.cjs';m.paths=Module._nodeModulePaths(process.cwd());m._compile(bundle.outputFiles[0].text,m.filename);const a=m.exports;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
function save(id,active=true,image=true,order=1){const body={id:id??'',active:String(active),order,focalX:25,focalY:10,mobileX:30,mobileY:20,...(image?{image:{type:'image/png',data:png.toString('base64')}}:{})};return a.POST(new Request('https://hotwifesonyc.com/api/admin/homepage-banners',{method:'POST',headers:{origin:'https://hotwifesonyc.com','content-type':'application/json'},body:JSON.stringify(body)}));}
function remove(id){return a.DELETE(new Request('https://hotwifesonyc.com/api/admin/homepage-banners',{method:'DELETE',headers:{origin:'https://hotwifesonyc.com','content-type':'application/json'},body:JSON.stringify({id,confirmed:true})}));}
assert.equal((await a.bannerStore.list()).length,7);
let response=await save();assert.equal(response.status,200);let banners=(await response.json()).banners;assert.equal(banners.length,8);const added=banners[0];const previousSrc=added.src,oldImage=added.imageKey;
response=await save(added.id);assert.equal(response.status,200);banners=(await response.json()).banners;const edited=banners.find(b=>b.id===added.id);assert.equal(banners.length,8);assert.notEqual(edited.src,previousSrc);assert.ok(a.state.objects.has(oldImage));assert.ok(a.publicBanners(banners).some(b=>b.src===edited.src));assert.ok(!a.publicBanners(banners).some(b=>b.src===previousSrc));
assert.equal((await a.imageGET(new Request('https://hotwifesonyc.com'+edited.src))).status,200);assert.equal((await a.imageGET(new Request('https://hotwifesonyc.com'+previousSrc))).status,404);
assert.equal((await save(added.id,false,false)).status,200);assert.ok(!a.publicBanners(await a.bannerStore.list()).some(b=>b.id===added.id));
assert.equal((await save()).status,200);assert.equal((await save()).status,200);assert.equal((await a.bannerStore.list()).length,10);assert.equal((await save()).status,409);
const preservedImages=[...a.state.objects.keys()].filter(key=>key.startsWith('homepage-banners/images/'));
assert.equal((await remove(added.id)).status,200);banners=await a.bannerStore.list();assert.equal(banners.length,9);assert.ok(!a.publicBanners(banners).some(b=>b.id===added.id));assert.deepEqual(banners.map(b=>b.order),[1,2,3,4,5,6,7,8,9]);assert.deepEqual([...a.state.objects.keys()].filter(key=>key.startsWith('homepage-banners/images/')),preservedImages);
a.state.role='OPERATOR';assert.equal((await save()).status,403);assert.equal((await remove(banners[0].id)).status,403);
a.state.role='ADMIN';assert.equal((await save()).status,200);
// Conditional R2 writes prevent two simultaneous additions from exceeding the limit.
assert.equal((await remove((await a.bannerStore.list())[0].id)).status,200);const attempts=await Promise.all([save(),save()]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);assert.equal((await a.bannerStore.list()).length,10);
console.log('PASS: Add; Edit replaces image with same id; active/order/focal config; Delete removes from home and preserves files; 10-banner limit including concurrency; OWNER/ADMIN access, OPERATOR denied. No remote writes.');
