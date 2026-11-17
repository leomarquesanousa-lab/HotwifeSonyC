import { readFile, writeFile, mkdir, rename, readdir, open, unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { validateContent } from '../scripts/validate-content.mjs';
export const dataDirectory = () => resolve(process.env.SONY_DATA_DIR || join(process.cwd(), '.local'));
const revision = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function readContent() {
  let data;
  try { data = JSON.parse(await readFile(join(dataDirectory(),'content.json'),'utf8')); }
  catch(error) { if(error.code !== 'ENOENT') throw error; data = {site:JSON.parse(await readFile(join(process.cwd(),'content/site.json'),'utf8')),catalog:JSON.parse(await readFile(join(process.cwd(),'content/catalog.json'),'utf8'))}; }
  return {...data,revision:revision(data)};
}
let queue = Promise.resolve();
async function acquireLock() {
  const directory = dataDirectory();
  await mkdir(directory,{recursive:true,mode:0o700});
  const path = join(directory,'content.lock');
  for(let attempt=0;attempt<40;attempt++) {
    try {
      const handle = await open(path,'wx',0o600);
      try { await handle.writeFile(JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()})); }
      catch(error) { await handle.close(); await unlink(path); throw error; }
      return async () => { await handle.close(); await unlink(path); };
    } catch(error) { if(error.code !== 'EEXIST')throw error; await delay(50); }
  }
  throw Object.assign(new Error('Another process is saving. Try again shortly. If this persists, ask the operator to inspect the private content.lock file.'),{status:423});
}
export function saveContent(input, expectedRevision) {
  const work = queue.then(async () => {
    const releaseLock = await acquireLock();
    try {
    const current = await readContent();
    if(current.revision !== expectedRevision) throw Object.assign(new Error('Content changed in another session. Reload before saving.'),{status:409});
    validateContent(input.site,input.catalog);
    const data = {site:input.site,catalog:input.catalog};
    const directory = dataDirectory(); await mkdir(join(directory,'backups'),{recursive:true});
    await writeFile(join(directory,'backups',`${Date.now()}-${randomUUID()}.json`),JSON.stringify({site:current.site,catalog:current.catalog},null,2),{mode:0o600,flag:'wx'});
    const temporary = join(directory,`content-${randomUUID()}.tmp`);
    await writeFile(temporary,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});
    await rename(temporary,join(directory,'content.json'));
    return {...data,revision:revision(data)};
    } finally { await releaseLock(); }
  });
  queue = work.catch(()=>{}); return work;
}
export async function listImages() { return (await readdir(join(process.cwd(),'public/images'))).filter(name=>/\.(png|jpe?g|webp|avif)$/i.test(name)).map(name=>`/images/${name}`); }
