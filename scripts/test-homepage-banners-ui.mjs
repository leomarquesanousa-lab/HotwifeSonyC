import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
// Local UI and transport fixtures only. No database, R2 or production requests.
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import HomepageBanners from './src/components/store/HomepageBanners';import{defaultBanners}from './src/lib/homepage-banners/types';createRoot(document.getElementById('root')).render(<HomepageBanners initialBanners={defaultBanners}/>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,jsx:'automatic',write:false});
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:'<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
  browser=await chromium.launch();const page=await browser.newPage();let rows,serial=0;
  await page.route('**/api/admin/homepage-banners',async route=>{const data=route.request().postDataJSON();if(!rows)rows=await page.locator('article').count();const defaults=Array.from({length:rows},(_,i)=>({id:`original-${i}`,src:'/old.png',alt:'Banner',width:1600,height:900,order:i+1,active:true,focal:{x:50,y:50},mobileFocal:{x:50,y:50}}));rows=typeof rows==='number'?defaults:rows;
    if(route.request().method()==='DELETE')rows=rows.filter(row=>row.id!==data.id);else{const existing=rows.find(row=>row.id===data.id);const updated={...existing,id:existing?.id??`new-${++serial}`,src:data.image?`/replacement-${serial++}.png`:existing.src,active:data.active==='true',order:Number(data.order),focal:{x:Number(data.focalX),y:Number(data.focalY)},mobileFocal:{x:Number(data.mobileX),y:Number(data.mobileY)}};rows=existing?rows.map(row=>row.id===existing.id?updated:row):[...rows,updated];}await route.fulfill({contentType:'application/json',body:JSON.stringify({banners:rows})});});
  await page.goto(`http://127.0.0.1:${server.address().port}`);const add=page.getByRole('button',{name:'Add Banner',exact:true});const dialog=page.getByRole('dialog');
  const file={name:'banner.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')};
  await add.click();await dialog.locator('input[name=image]').setInputFiles(file);await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(await page.locator('article').count(),8);
  await page.getByRole('button',{name:'Edit banner 1',exact:true}).click();await dialog.locator('input[name=image]').setInputFiles(file);await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(await page.locator('article').count(),8);assert.match(await page.locator('article img').first().getAttribute('src'),/replacement/);assert.equal(rows[0].id,'original-0');
  await page.getByRole('button',{name:'Delete banner 1',exact:true}).click();await dialog.getByText('This banner will be removed from the homepage carousel.',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('article').count(),8);
  await page.getByRole('button',{name:'Delete banner 1',exact:true}).click();await dialog.getByRole('button',{name:'Delete',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(await page.locator('article').count(),7);
  for(let i=0;i<3;i++){await add.click();await dialog.locator('input[name=image]').setInputFiles(file);await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'detached'});}assert.equal(await add.isDisabled(),true);await page.getByText('Maximum of 10 banners reached.',{exact:true}).waitFor();
  console.log('PASS: browser UI Add, Edit image/same id, Delete confirmation/cancel/removal, disabled Add at 10. Isolated fixtures.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
