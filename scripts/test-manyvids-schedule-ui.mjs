// Actual distribution page, isolated browser, API fixtures only.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "playwright";
const messages = JSON.parse(
  await readFile(
    new URL("../i18n/messages/pt-BR.json", import.meta.url),
    "utf8",
  ),
);
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "tsx",
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {NextIntlClientProvider} from 'next-intl';import Page from './app/[locale]/app/distribution/page';createRoot(document.getElementById('root')).render(<NextIntlClientProvider locale="pt-BR" messages={${JSON.stringify(messages)}} timeZone="UTC"><Page/></NextIntlClientProvider>);`,
  },
  bundle: true,
  write: false,
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  logLevel: "silent",
  plugins: [
    {
      name: "navigation-fixture",
      setup(b) {
        b.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: "navigation",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: 'export const useParams=()=>({locale:"pt-BR"});',
          loader: "js",
        }));
      },
    },
  ],
});
const server = createServer((req, res) => {
  res.setHeader(
    "Content-Type",
    req.url?.startsWith("/app.js") ? "text/javascript" : "text/html",
  );
  res.end(
    req.url?.startsWith("/app.js")
      ? bundle.outputFiles[0].text
      : '<div id="root"></div><script src="/app.js"></script>',
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const media = {
    id: "m",
    creatorId: "c",
    originalFileName: "Fixture.mp4",
    fileSize: "100",
    mediaType: "VIDEO",
    status: "UPLOADED",
    durationSeconds: 14,
    width: 1080,
    height: 1920,
    categories: [],
  };
  let creates = 0,
    executes = 0,
    submitted,
    freshDuration = 14;
  const staleMedia = {
    ...media,
    durationSeconds: 0,
    width: null,
    height: null,
  };
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "creator-platform:manyvids-drafts:v1",
      JSON.stringify({
        "c:m": {
          title: "Fixture title",
          description: "Fixture",
          price: "10",
          tags: [
            { id: "1", label: "one" },
            { id: "2", label: "two" },
            { id: "3", label: "three" },
          ],
          options: {
            performers: [],
            performerRowIds: [],
            confirmedNoPerformers: true,
            thumbnail: { source: "generate_from_video" },
            teaser: { source: "generate_from_video", startTime: 10 },
          },
        },
      }),
    ),
  );
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    let data = { success: true };
    if (u.pathname === "/api/distribution/options")
      data = {
        ...data,
        timeZone: "America/Los_Angeles",
        creators: [{ id: "c", displayName: "Creator fixture" }],
        media: [staleMedia],
        platformAccounts: [
          {
            id: "a",
            creatorId: "c",
            platform: "MANYVIDS",
            status: "CONNECTED",
            externalDisplayName: "Fixture ManyVids",
          },
        ],
      };
    else if (u.pathname === "/api/performers")
      data = {
        ...data,
        performers: [
          { id: "person", displayName: "Performer fixture", status: "ACTIVE" },
        ],
      };
    else if (u.pathname === "/api/media")
      data = { ...data, media: [staleMedia] };
    else if (u.pathname === "/api/performer-library")
      data = { ...data, folders: [] };
    else if (u.pathname === "/api/distribution/manyvids/options")
      data = {
        ...data,
        assets: [
          {
            ...media,
            durationSeconds: freshDuration,
            fileSize: 100,
            label: "Fixture.mp4",
          },
        ],
        performers: [],
      };
    else if (u.pathname === "/api/distribution") {
      creates++;
      submitted = route.request().postDataJSON();
      data = {
        ...data,
        distributionJob: { id: "j", status: "SCHEDULED" },
        publications: [
          {
            id: "p",
            platform: "MANYVIDS",
            platformAccountId: "a",
            status: "SCHEDULED",
          },
        ],
      };
    } else if (u.pathname === "/api/distribution/execute/manyvids") {
      executes++;
      data = { success: false };
    } else if (u.pathname.endsWith("/preview"))
      data = {
        ...data,
        previewUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      };
    else return route.fulfill({ status: 404, body: "fixture" });
    return route.fulfill({ json: data });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page
    .getByRole("button", {
      name: /Escolher um vídeo|Escolher vídeo|Selecionar um vídeo/,
    })
    .first()
    .click();
  await page.getByText("Fixture.mp4", { exact: true }).last().click();
  await page.getByText("Fixture ManyVids", { exact: true }).click();
  await page
    .getByText(/Datas e horários usam o fuso/)
    .first()
    .waitFor();
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent.trim() === "Publicar agora",
      )?.disabled,
  );
  assert.equal(
    await page
      .getByText("Choose a start time within the video.", { exact: false })
      .count(),
    0,
  );
  freshDuration = null;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page
    .getByText(messages.manyVids.olderVideoNeedsMetadata, { exact: false })
    .first()
    .waitFor();
  assert.equal(
    await page
      .getByText(messages.manyVids.invalidTeaserStart, { exact: false })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Publicar agora", exact: true })
      .isDisabled(),
    true,
  );
  freshDuration = 14;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent.trim() === "Publicar agora",
      )?.disabled,
  );
  const schedule = page.getByRole("button", { name: "Agendar", exact: true });
  assert.equal(await schedule.isEnabled(), true);
  await schedule.click();
  await page.getByRole("button", { name: "Amanhã", exact: true }).click();
  await page.locator('input[type="time"]').fill("10:00");
  await page
    .getByRole("button", { name: "Confirmar agendamento", exact: true })
    .click();
  assert.equal(creates, 0);
  assert.equal(executes, 0);
  await page
    .getByRole("button", { name: "Agendar publicação", exact: true })
    .click();
  await page
    .getByText(/Nenhum vídeo foi enviado ou publicado ainda/)
    .first()
    .waitFor();
  assert.equal(creates, 1);
  assert.equal(executes, 0);
  assert.equal(submitted.publishMode, "SCHEDULED");
  assert.equal(submitted.manyVidsOptions.teaser.startTime, 10);
  assert.match(submitted.scheduledAt, /Z$/);
  assert.equal(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(submitted.scheduledAt)),
    "10",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Interface: Agendar disponível, seletor/fuso, início 10/14 válido, snapshot UTC e nenhuma execução imediata.",
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
