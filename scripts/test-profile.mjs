// Actual profile APIs, with in-memory audit records and storage spies. No live environment.
import assert from 'node:assert/strict';
import Module from 'node:module';
import {build} from 'esbuild';
import {fixture} from './fixtures/store-db.mjs';
const root=process.cwd();
const result=await build({stdin:{resolveDir:root,contents:`export {GET,POST} from './app/api/account/profile/route';export {GET as photo} from './app/api/account/profile/photo/route';export {state} from 'fixture';export {storage} from 'storage-fixture';`},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'isolated',setup(b){
 b.onResolve({filter:/(?:prisma\/db$|auth\/session$|^\.\/session$|^fixture$|^server-only$)/},a=>({path:a.path==='server-only'?'empty':'db',namespace:'fixture'}));
 b.onResolve({filter:/storage\/r2$|^storage-fixture$/},()=>({path:'storage',namespace:'fixture'}));
 b.onResolve({filter:/dotenv/},()=>{throw Error('Live services forbidden');});
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='empty'?'':a.path==='db'?fixture.replace('user:{id:state.userId}','user:{id:state.userId,firstName:"Fictional",lastName:"Tester"}'):`export const storage={puts:[],gets:[]};export const getR2BucketName=()=> 'synthetic';export const getR2Client=()=>({async send(c){if(c.constructor.name==='PutObjectCommand'){storage.puts.push(c.input);return {};}storage.gets.push(c.input);const object=storage.puts.find(o=>o.Key===c.input.Key);return {ContentType:object.ContentType,ContentLength:object.Body.length,Body:{transformToByteArray:async()=>object.Body}};}});`,loader:'js'}));
}}]});
const mod=new Module(root+'/scripts/profile.memory.cjs');mod.filename=mod.id;mod.paths=Module._nodeModulePaths(root);mod._compile(result.outputFiles[0].text,mod.filename);const a=mod.exports;
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const request=(data=image.toString('base64'),origin='https://example.test')=>new Request('https://example.test/api/account/profile',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({data})});
a.state.userId=null;assert.equal((await a.GET()).status,401);assert.equal((await a.POST(request())).status,401);
a.state.userId='test-owner';assert.deepEqual(await (await a.GET()).json(),{name:'Fictional Tester',hasPhoto:false});
assert.equal((await a.POST(request(image.toString('base64'),'https://evil.test'))).status,403);assert.equal((await a.POST(request(Buffer.from('<svg/>').toString('base64')))).status,400);assert.equal((await a.POST(request(Buffer.alloc(2200000).toString('base64')))).status,413);assert.equal(a.storage.puts.length,0);
assert.equal((await a.POST(request())).status,200);assert.equal((await (await a.GET()).json()).hasPhoto,true);
const photo=await a.photo();assert.equal(photo.status,200);assert.equal(photo.headers.get('cache-control'),'private, no-store');assert.deepEqual(Buffer.from(await photo.arrayBuffer()),image);
a.state.userId='another-user';assert.equal((await (await a.GET()).json()).hasPhoto,false);assert.equal((await a.photo()).status,404);
a.state.userId='test-owner';assert.equal((await a.POST(request())).status,200);assert.equal(a.storage.puts.length,2);assert.notEqual(a.storage.puts[0].Key,a.storage.puts[1].Key);assert.equal(a.state.tables.AuditLog.length,2);
a.state.failTable='AuditLog';assert.equal((await a.POST(request())).status,500);a.state.failTable=null;assert.equal(a.state.tables.AuditLog.length,2);assert.equal((await (await a.GET()).json()).hasPhoto,true);
console.log('PASS: real profile API, session/origin, type/size checks, default/custom photo, user isolation, retained versions/audit and database failure; no production writes or R2 calls.');
