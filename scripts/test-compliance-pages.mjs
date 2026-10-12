import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs';

// Run against a local next start. Never submit valid data to the production database.
const base = process.env.COMPLIANCE_TEST_ORIGIN || 'http://localhost:3107';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const routes = ['privacy','terms','acceptable-use','anti-trafficking','child-safety','age-verification','consent','content-moderation','report-content','content-removal','depicted-person-removal','dmca','2257','refunds','billing','contact','compliance','data-deletion'];
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const path of routes) {
    const response = await page.goto(`${base}/${path}`);
    assert.equal(response.status(), 200, path);
    assert.ok(await page.title(), path);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://hotwifesonyc.com/${path}`);
    assert.ok(await page.locator('meta[name="description"]').getAttribute('content'));
    assert.equal(await page.locator('.legal-footer a').count(), 17);
    assert.ok(await page.locator('.legal-footer').innerText().then(t => t.includes('Adults only / 18+')));
    assert.equal(await page.locator('.age-gate-shield').count(), 0);
    for (const href of await page.locator('.legal-footer a').evaluateAll(links => links.map(a => a.getAttribute('href')))) assert.ok(routes.includes(href.slice(1)), href);
  }
  for (const path of ['report-content','depicted-person-removal']) {
    let payload;
    await page.route('**/api/compliance/reports', async route => {
      payload = route.request().postDataJSON();
      await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({reference:'isolated-browser-reference'})});
    });
    await page.goto(`${base}/${path}`);
    await page.locator('[name="contentUrl"]').fill('https://hotwifesonyc.com/videos/test');
    await page.locator('[name="reason"]').selectOption('Non-consensual content');
    await page.locator('[name="reporterName"]').fill('Browser Test');
    await page.locator('[name="reporterEmail"]').fill('browser@example.test');
    await page.locator('textarea[name="description"]').fill('Please review the authorization for this test content.');
    await page.locator('[name="truthful"]').check();
    await page.getByRole('button',{name:'Submit request',exact:true}).click();
    await page.getByRole('heading',{name:'Request received'}).waitFor();
    assert.equal(payload.kind,path==='report-content'?'CONTENT':'DEPICTED_PERSON');
    assert.equal(payload.depictedPerson,path!=='report-content');
    await page.unroute('**/api/compliance/reports');
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${base}/compliance`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  fs.mkdirSync('.runtime/compliance-qa',{recursive:true});
  await page.screenshot({path:'.runtime/compliance-qa/mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${base}/privacy`);
  await page.screenshot({path:'.runtime/compliance-qa/desktop.png',fullPage:true});
  const admin = await page.request.get(`${base}/api/admin/compliance`);
  assert.equal(admin.status(),401);
  const invalid = await page.request.post(`${base}/api/compliance/reports`,{headers:{Origin:base},data:{}});
  assert.equal(invalid.status(),403); // Configured canonical origin rejects localhost writes before DB access.
  assert.deepEqual(errors,[]);
  console.log('PASS: 18 public routes, canonical/metadata, footer links, desktop/mobile layout, report and depicted-person UI (intercepted transport), anonymous admin denial, local-origin report rejection; no valid database submission.');
} finally { await browser.close(); }
