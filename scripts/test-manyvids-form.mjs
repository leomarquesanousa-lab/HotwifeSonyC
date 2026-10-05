// Local browser regression checks. All API responses are fixtures; no authenticated profile is used.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "playwright";

const locales = ["en-US", "pt-BR", "es-ES", "fr-FR", "cs-CZ"];
const messages = Object.fromEntries(await Promise.all(locales.map(async (locale) => [locale, JSON.parse(await readFile(new URL(`../i18n/messages/${locale}.json`, import.meta.url), "utf8"))])));
const fixture = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {NextIntlClientProvider} from 'next-intl';
import {ManyVidsPublishingOptions} from './src/components/app/ManyVidsPublishingOptions';
import {ManyVidsTagPicker} from './src/components/app/ManyVidsTagPicker';
import {useManyVidsDraft} from './src/components/app/useManyVidsDraft';
const messages = ${JSON.stringify(messages)};
function Form(){
 const [scope,setScope]=useState('creator:video');
 const [locale,setLocale]=useState('en-US');
 const [reason,setReason]=useState('');
 const d=useManyVidsDraft(scope,'Initial title','Initial description');
 return <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
  <button id="scope" onClick={()=>setScope(s=>s==='creator:video'?'creator:other':'creator:video')}>Scope fixture</button>
  <select id="locale" value={locale} onChange={e=>setLocale(e.target.value)}>{Object.keys(messages).map(l=><option key={l}>{l}</option>)}</select>
  <input id="title" value={d.manyVidsTitle} onChange={e=>d.setManyVidsTitle(e.target.value)}/>
  <input id="price" value={d.manyVidsPrice} onChange={e=>d.setManyVidsPrice(e.target.value)}/>
  <ManyVidsTagPicker accountId="fixture" value={d.manyVidsTags} onChange={d.setManyVidsTags}/>
  <ManyVidsPublishingOptions key={scope} value={d.manyVidsOptions} onChange={d.setManyVidsOptions} accountId="fixture" videoDuration={60} mediaId="fixture" performerId="person" locale={locale} publishMode="NOW" onBlockReason={setReason}/>
  <output id="reason">{reason}</output><output id="draft">{JSON.stringify(d)}</output>
 </NextIntlClientProvider>;
}
createRoot(document.getElementById('root')).render(<Form/>);
`;
const bundle = await build({ stdin: { contents: fixture, loader: "tsx", resolveDir: process.cwd() }, bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent" });
const server = createServer((request, response) => {
  response.setHeader("Content-Type", request.url === "/app.js" ? "text/javascript" : "text/html");
  response.end(request.url === "/app.js" ? bundle.outputFiles[0].text : '<div id="root"></div><script src="/app.js"></script>');
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let optionRequests = 0;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/options")) {
      optionRequests++;
      return route.fulfill({ json: { success: true, assets: [
        { id: "image", label: "Related image", mediaType: "IMAGE", contentType: "image/png", fileSize: 30, performerIds: ["person"] },
        { id: "other-image", label: "Another image", mediaType: "IMAGE", contentType: "image/jpeg", fileSize: 30, performerIds: [] },
        { id: "unsupported", label: "Unsupported SVG", mediaType: "IMAGE", contentType: "image/svg+xml", fileSize: 30 },
      ], performers: [] } });
    }
    if (url.pathname.endsWith("/tags")) {
      const query = url.searchParams.get("keywords");
      if (query === "old") await new Promise((resolve) => setTimeout(resolve, 500));
      return route.fulfill({ json: { success: true, tags: query === "missing" ? [] : [{ id: "11", label: query === "old" ? "Old" : "Existing" }] } });
    }
    if (url.pathname.endsWith("/preview")) return route.fulfill({ json: { success: true, previewUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" } });
    // Never reach any real endpoint, including media, publishing or performer search.
    return route.fulfill({ status: 404, body: "fixture" });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole("checkbox").check();
  await page.waitForFunction(() => document.querySelector("#reason").textContent === "");
  assert.equal(await page.getByLabel("Duration (seconds)", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Add media to the library", { exact: true }).count(), 0);
  await page.locator("#title").fill("My edited title");
  await page.locator("#price").fill("12.50");
  // Scope the combobox to the accessible tags control (the locale select is also a combobox).
  const search = page.getByPlaceholder("Search ManyVids tags");
  await search.fill("old");
  await page.waitForTimeout(350);
  await search.fill("exist");
  await page.getByRole("option", { name: "Existing", exact: true }).click();
  await search.fill("exist");
  await page.getByText("No other matching tags found.").waitFor();
  assert.equal(await page.getByRole("option", { name: "Existing", exact: true }).count(), 0);
  await search.fill("missing");
  await page.getByRole("button", { name: /Create new tag/ }).waitFor();
  assert.equal(await page.getByRole("button", { name: /Create new tag/ }).isDisabled(), true);
  await search.fill("");
  // Use a generated local stream so the actual HTMLVideoElement can seek without a media server.
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext("2d"); const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" }); const chunks = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.start();
    for (let i = 0; i < 115; i++) { ctx.fillStyle = i < 60 ? "red" : "blue"; ctx.fillRect(0, 0, 64, 64); await new Promise((resolve) => setTimeout(resolve, 100)); }
    recorder.stop(); await stopped; stream.getTracks().forEach((track) => track.stop());
    const video = document.querySelector("video"); video.src = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
    await new Promise((resolve) => { video.onloadeddata = resolve; video.load(); });
  });
  await page.getByLabel("Frame time in seconds (optional)").fill("10");
  await page.waitForFunction(() => Math.abs(document.querySelector("video").currentTime - 10) < 0.05 && !document.querySelector("video").seeking);
  assert.equal(await page.locator("#reason").textContent(), "");
  const blue = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = 64; canvas.height = 64; const ctx = canvas.getContext("2d"); ctx.drawImage(document.querySelector("video"), 0, 0); return ctx.getImageData(20, 20, 1, 1).data[2]; });
  assert.ok(blue > 180, "Preview must show the actual blue frame at ten seconds");
  const state = JSON.parse(await page.locator("#draft").textContent());
  assert.deepEqual(state.manyVidsOptions.thumbnail, { source: "generate_from_video" });
  assert.deepEqual(state.manyVidsOptions.teaser, { source: "generate_from_video", startTime: 0 });
  assert.deepEqual(state.manyVidsTags, [{ id: "11", label: "Existing" }]);
  const requestsBefore = optionRequests;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(() => document.querySelector("#title").value === "My edited title");
  await page.waitForTimeout(100);
  assert.ok(optionRequests > requestsBefore);
  for (const locale of locales) { await page.locator("#locale").selectOption(locale); assert.equal(await page.locator("#title").inputValue(), "My edited title"); }
  await page.locator("#locale").selectOption("en-US");
  await page.locator("#scope").click(); await page.locator("#scope").click();
  assert.equal(await page.locator("#title").inputValue(), "My edited title");
  assert.equal(await page.locator("#price").inputValue(), "12.50");
  await page.getByRole("group", { name: "Thumbnail", exact: true }).locator("select").selectOption("upload_custom");
  await page.getByLabel("Search images (JPEG / PNG)").fill("Related");
  await page.getByRole("button", { name: /Related image/ }).click();
  assert.equal(await page.getByText("Unsupported SVG", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "+ Add performer", exact: true }).click();
  await page.getByLabel("Name / identification").fill("Incomplete account draft");
  await page.reload();
  assert.equal(await page.locator("#title").inputValue(), "My edited title");
  await page.getByRole("button", { name: "Remove image", exact: true }).waitFor();
  assert.equal(JSON.parse(await page.locator("#draft").textContent()).manyVidsOptions.thumbnail.mediaAssetId, "image");
  assert.equal(await page.getByLabel("Name / identification").inputValue(), "Incomplete account draft");
  assert.deepEqual(errors, []);
  console.log("ManyVids local browser checks passed: tags, frame seeking, automatic teaser, image filtering, refresh/locale/scope/reload draft retention.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
