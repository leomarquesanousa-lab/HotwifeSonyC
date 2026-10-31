// Synthetic library only. Never opens a video or connects to storage/database.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Page from './app/[locale]/app/media/page';createRoot(document.getElementById('root')).render(<Page/>);` }, bundle: true, write: false, jsx: 'automatic', plugins: [{ name: 'isolated', setup(b) {
  b.onResolve({ filter: /^next-intl$|^next\/link$|UploadManagerProvider$|MediaPreviewModal$/ }, a => ({ path: a.path, namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path === 'next/link' ? `import React from 'react';export default function Link(p){return React.createElement('a',p);}` : a.path === 'next-intl' ? `export const useLocale=()=> 'en-US';export const useTranslations=()=>key=>key;` : a.path.endsWith('MediaPreviewModal') ? 'export default function Modal(){throw Error("Do not open real media");}' : `export const useUploadManager=()=>({uploads:[],isUploading:false});`, loader: 'js', resolveDir: process.cwd() }));
} }] });
const server = createServer((req, res) => { res.setHeader('Content-Type', req.url === '/app.js' ? 'text/javascript' : 'text/html'); res.end(req.url === '/app.js' ? bundle.outputFiles[0].text : '<div id="root"></div><script src="/app.js"></script>'); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch(); const page = await browser.newPage(); let deleted = false, allowed = true, fail = true, calls = 0;
  const media = { id: '77777777-7777-4777-8777-777777777777', originalFileName: 'synthetic.mp4', fileSize: '100', contentType: 'video/mp4', mediaType: 'VIDEO', status: 'UPLOADED', createdAt: '2026-01-01', products: [] };
  await page.route('**/api/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    if (req.method() === 'DELETE') { calls++; assert.deepEqual(req.postDataJSON(), { confirmed: true }); assert.equal(req.headers()['content-type'], 'application/json'); await route.fulfill({ status: fail ? 409 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { success: false, message: 'This file is used by a video product.' } : { success: true, storageCleanupPending: true, message: 'Media removed. Storage cleanup is pending.' }) }); if (!fail) deleted = true; return; }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(path === '/api/media' ? { success: true, canDelete: allowed, media: deleted ? [] : [media] } : { success: true, categories: [] }) });
  });
  await page.goto(origin); const remove = page.getByTitle('removeVideo', { exact: true }); await remove.waitFor();
  page.once('dialog', d => d.dismiss()); await remove.click(); assert.equal(calls, 0);
  page.once('dialog', d => d.accept()); await remove.click(); await page.getByRole('alert').filter({ hasText: 'used by a video product' }).waitFor(); assert.equal(calls, 1); assert.equal(await remove.count(), 1);
  fail = false; page.once('dialog', d => d.accept()); await remove.click(); await page.getByRole('status').filter({ hasText: 'cleanup is pending' }).waitFor(); await remove.waitFor({ state: 'detached' }); assert.equal(calls, 2);
  deleted = false; allowed = false; await page.reload(); await page.getByText('synthetic.mp4', { exact: true }).first().waitFor(); assert.equal(await remove.isVisible(), false); assert.equal(calls, 2);
  console.log('PASS: library deletion cancel/confirm, confirmed JSON, protected-reference error/retry, list refresh, pending cleanup feedback and unauthorized button hidden. No media opened.');
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
