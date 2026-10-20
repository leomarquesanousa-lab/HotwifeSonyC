// Isolated authorization and signing contract; no .env, database or R2 connection.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Module from 'node:module';
import { fixture } from './fixtures/store-db.mjs';
const root=process.cwd();
const bundle=await build({stdin:{contents:`export {GET} from './app/api/media/[id]/preview/route';export {state} from 'fixture';`,resolveDir:root},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'isolate',setup(b){
 b.onResolve({filter:/(?:prisma\/db$|auth\/session$|^\.\/session$|^fixture$|^server-only$|storage\/r2$)/},a=>({path:a.path==='server-only'?'empty':a.path.endsWith('storage/r2')?'storage':'fixture',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='empty'?'':a.path==='storage'?`export async function getR2ObjectDownloadUrl(key,ttl){return 'https://private.example/'+key+'?X-Amz-Expires='+ttl;}`:fixture,loader:'js'}));
}}]});
const m=new Module(root+'/scripts/preview.memory.cjs');m.filename=root+'/scripts/preview.memory.cjs';m.paths=Module._nodeModulePaths(root);m._compile(bundle.outputFiles[0].text,m.filename);
const {GET,state}=m.exports;
async function get(id='full'){return GET(new Request('http://localhost/api/media/'+id+'/preview'),{params:Promise.resolve({id})});}
function seed(role='OWNER'){state.userId='user';state.tables={Workspace:[{id:'workspace',status:'ACTIVE'}],WorkspaceMember:[{userId:'user',workspaceId:'workspace',role}],MediaAsset:[{id:'full',workspaceId:'workspace',status:'UPLOADED',objectKey:'private/full.mp4'},{id:'teaser',workspaceId:'workspace',status:'READY',objectKey:'private/teaser.mp4'},{id:'foreign',workspaceId:'another',status:'UPLOADED',objectKey:'secret'}]};}
for(const role of ['OWNER','ADMIN','OPERATOR']){seed(role);for(const id of ['full','teaser']){const res=await get(id);assert.equal(res.status,200);assert.match(res.headers.get('cache-control'),/no-store/);assert.equal(res.headers.get('vary'),'Cookie');const data=await res.json();assert.equal(data.expiresIn,900);assert.match(data.previewUrl,/X-Amz-Expires=900/);}}
seed('MEMBER');assert.equal((await get()).status,403);
seed();state.userId=null;assert.equal((await get()).status,401);
seed();assert.equal((await get('foreign')).status,404);assert.equal((await get('missing')).status,404);
seed();state.tables.Workspace[0].status='INACTIVE';assert.equal((await get()).status,403);
seed();state.tables.MediaAsset[0].status='UPLOADING';assert.equal((await get()).status,409);
console.log('PASS: existing full/teaser, administrative roles, anonymous/member/inactive workspace/foreign media denied, unavailable files, 900s signer contract and private no-store responses. R2 mocked.');
