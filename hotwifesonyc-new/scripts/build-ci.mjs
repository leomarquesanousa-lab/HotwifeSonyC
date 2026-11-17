import {spawnSync} from 'node:child_process';
// Keep raw build output in the runner only. Publish fixed diagnostic labels,
// never log excerpts, environment variables, credentials or user content.
const run=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build','--webpack'],{encoding:'utf8',maxBuffer:16*1024*1024});
if(run.status===0){console.log('Production build completed successfully.');process.exit(0);}
const output=(run.stdout??'')+(run.stderr??'');
const labels=[
  [/SIGABRT/,'Worker aborted with SIGABRT'],
  [/EAGAIN|uv_thread_create/,'Operating-system thread or process limit'],
  [/heap out of memory|ENOMEM/i,'Memory allocation failure'],
  [/Type error:|error TS\d+/,'TypeScript build error'],
  [/ENOENT/,'Required file missing'],
  [/ENOSPC/,'Insufficient disk space'],
  [/prerendering page/,'Page prerender failure'],
  [/Cannot find module|Module not found/,'Module resolution failure'],
  [/ERR_WORKER_INVALID_EXEC_ARGV/,'Invalid worker arguments'],
];
let found=false;
for(const [pattern,label]of labels)if(pattern.test(output)){found=true;console.log(`::error::Build diagnostic: ${label}`);}
for(const route of ['/','/_not-found','/catalog','/admin','/admin/login','/robots.txt','/sitemap.xml'])if(output.includes(`prerendering page "${route}"`))console.log(`::error::Known failing route: ${route}`);
if(!found)console.log('::error::Unclassified build failure; raw logs were not copied or published.');
process.exit(run.status??1);
