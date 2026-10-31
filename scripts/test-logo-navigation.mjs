// Actual headers with local navigation and placeholder images only. No private media.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `import React from 'react';import {createRoot} from 'react-dom/client';import AppHeader from './src/components/app/AppHeader';import {StoreShell} from './components/storefront/Storefront';import AgeGate from './components/compliance/AgeGate';const mode=location.pathname;createRoot(document.getElementById('root')).render(mode==='/app'?<AppHeader role="OWNER"/>:mode==='/gate'?<AgeGate/>:<StoreShell><p>Public fixture</p></StoreShell>);` }, bundle: true, write: false, jsx: 'automatic', plugins: [{ name: 'local', setup(b) {
  b.onResolve({ filter: /^next\/(link|image|navigation)$|^next-intl$|UploadManagerProvider$/ }, a => ({ path: a.path, namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path === 'next/navigation' ? `export const useParams=()=>({locale:'en-US'});export const usePathname=()=> location.pathname==='/gate'?'/videos':location.pathname;` : a.path === 'next-intl' ? `export const useTranslations=()=>key=>key;` : a.path.endsWith('UploadManagerProvider') ? `export const useUploadManager=()=>({uploads:[],isUploading:false});` : a.path === 'next/image' ? `import React from 'react';export default function Image(p){return React.createElement('img',p);}` : `import React from 'react';export default function Link(p){return React.createElement('a',p);}`, loader: 'js', resolveDir: process.cwd() }));
} }] });
const server = createServer((req, res) => { res.setHeader('Content-Type', req.url === '/app.js' ? 'text/javascript' : 'text/html'); res.end(req.url === '/app.js' ? bundle.outputFiles[0].text : '<div id="root"></div><script src="/app.js"></script>'); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`; let browser;
try {
  browser = await chromium.launch(); const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/logo-hotwifesonyc.png', route => route.fulfill({ status: 204, body: '' }));
  for (const width of [390, 1280]) for (const path of ['/app', '/videos', '/gate']) {
    await page.setViewportSize({ width, height: 844 }); await page.goto(origin + path); const logos = page.locator('a').filter({ has: page.getByAltText('HotwifeSonyC', { exact: true }) });
    await logos.first().waitFor(); for (let i = 0; i < await logos.count(); i++) assert.equal(await logos.nth(i).getAttribute('href'), '/');
    await logos.first().click(); await page.waitForURL(origin + '/');
  }
  assert.deepEqual(errors, []); console.log('PASS: actual admin, public header/footer and age-gate logos navigate to public home on mobile/desktop. Canonical English routing preserved; no images/media loaded.');
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
