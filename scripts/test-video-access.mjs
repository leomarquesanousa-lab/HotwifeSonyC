import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Module from 'node:module';
import fs from 'node:fs';
const fixture = `
export const state = { role: null, status: null, purchaseQueries: 0, active: true, loggedIn: true };
export async function getCurrentSession() { return state.loggedIn ? {user:{id:'user'}} : null; }
export class AuthError extends Error {}
export const db = {orm:{public:new Proxy({}, {get(_, table) { return {where(filter) {
if(table === 'Purchase') state.purchaseQueries++;
let predicate = filter;
return {where(fn) { predicate = fn({role:{in: roles => roles.includes(state.role)}}); return this; },
async all() { return table === 'WorkspaceMember' && predicate ? [{workspaceId:'workspace',role:state.role}] : []; },
async first() {
if(table === 'Purchase') return state.status === filter.status ? {status:state.status} : null;
if(table === 'Workspace') return state.active ? {id:'workspace'} : null;
if(table === 'VideoProduct') return {id:'11111111-1111-4111-8111-111111111111',workspaceId:'workspace',mediaAssetId:'media'};
if(table === 'MediaAsset') return {objectKey:'private/video.mp4',contentType:'video/mp4'};
return null;
}};
}}}})}};
`;
const result = await build({stdin:{contents:`export {POST} from './app/api/account/videos/[id]/watch/route'; export {state} from 'fixture';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'fixture',setup(b){b.onResolve({filter:/(?:prisma\/db$|auth\/session$|auth\/request$|^fixture$|^server-only$)/},args=>({path:args.path==='server-only'?'server-only':'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='server-only'?'':fixture,loader:'js'}));}}]});
const m = new Module(process.cwd()+'/scripts/video-tests.memory.cjs'); m.filename=process.cwd()+'/scripts/video-tests.memory.cjs'; m.paths=Module._nodeModulePaths(process.cwd());m._compile(result.outputFiles[0].text,m.filename);
const {POST,state} = m.exports;
Object.assign(process.env,{R2_ACCOUNT_ID:'test',R2_ACCESS_KEY_ID:'test-key',R2_SECRET_ACCESS_KEY:'test-secret',R2_BUCKET_NAME:'test-bucket'});
const invoke=()=>POST(new Request('https://example.test/api/account/videos/id/watch',{method:'POST'}),{params:Promise.resolve({id:'11111111-1111-4111-8111-111111111111'})});
for(const role of ['OWNER','ADMIN','OPERATOR',null]) {
state.role=role;
for(const status of [null,'PENDING','PAID','CANCELED','REFUNDED']) {
state.status=status;state.purchaseQueries=0;
const response=await invoke();assert.equal(response.status,role || status==='PAID'?200:403,`${role}/${status}`);
assert.equal(state.purchaseQueries,role?0:1);
if(response.ok){const data=await response.json();assert.deepEqual(Object.keys(data),['url']);const url=new URL(data.url);assert.equal(url.searchParams.get('X-Amz-Expires'),'900');assert.ok(url.searchParams.get('X-Amz-Signature'));}
}
}
state.role='ADMIN';state.status=null;state.active=false;assert.equal((await invoke()).status,403);
state.loggedIn=false;assert.equal((await invoke()).status,401);
const player=fs.readFileSync('components/storefront/VideoModal.tsx','utf8');assert.match(player,/controlsList="nodownload"/);assert.doesNotMatch(player,/<a[^>]*download/);
console.log('PASS: roles, paid/unpaid/pending/canceled/refunded customers, inactive workspace, anonymous access, signed 900s URLs, URL-only response and no download UI. Isolated DB/session fixtures; real authorization, watch handler and R2 signer.');

