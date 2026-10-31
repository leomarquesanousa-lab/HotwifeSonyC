import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

// Isolated UI fixture: no Next server, environment loading, database or external requests.
const bundle = await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import AgeGate from './components/compliance/AgeGate';createRoot(document.getElementById('root')).render(<AgeGate/>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,platform:'browser',format:'iife',write:false,jsx:'automatic',plugins:[{name:'navigation-fixture',setup(b){b.onResolve({filter:/^next\/(navigation|link|image)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('navigation')?'export const usePathname=()=>window.location.pathname;':`import React from 'react';export default function Link(p){return React.createElement('${a.path.endsWith('image') ? 'img' : 'a'}',p);}`,loader:'js',resolveDir:process.cwd()}));}}]});
const css=readFileSync('components/compliance/compliance.css','utf8');
const server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);return;}res.setHeader('Content-Type','text/html');res.end(`<html><head><style>${css}</style></head><body><main style="height:2000px">Underlying test page</main><div id="root"></div><script src="/bundle.js"></script></body></html>`);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(`${origin}/videos/test`);
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true);
  const enter=page.getByRole('button',{name:'Enter site'});assert.equal(await enter.isDisabled(),true);
  assert.equal(await page.getByRole('checkbox').count(),1);
  await page.getByRole('checkbox').check();assert.equal(await enter.isDisabled(),false);
  await enter.click();await dialog.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  await page.reload();assert.equal(await page.locator('dialog').count(),0);
  await page.evaluate(()=>sessionStorage.clear());
  await page.goto(`${origin}/report-content`);assert.equal(await page.locator('dialog').count(),0);
  await page.goto(`${origin}/`);await page.getByRole('dialog').waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('PASS: existing age confirmation required; ESC bypass blocked, scroll restored, session acknowledgment retained, reporting exempt and mobile layout fits. Synthetic fixture only.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
