// Read-only source audit plus local browser smoke test. Never loads .env.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';

const inactiveLocales = ['pt-BR', 'es-ES', 'fr-FR', 'cs-CZ'];
const portuguese = /\b(?:Assistir|corrigido|Salvar|Excluir|Carregar|Entrar|Cadastrar|Senha|Voltar|Cancelar|Selecione|Nenhum|Aguarde|sucesso|arquivo|Publicar|Falha|Atualizar|Carregando|Ocorreu|Digite|Preencha|Confira|Verifique|Aguardando|Enviar|Remover|Fechar|Abrir|Conectar|Desconectar|atualizado|adicionado|removido|encontrado|falhou|Pronto|Copiar|Continuar)\b|[\u00e3\u00f5\u00e7]/i;
function filesIn(path) {
  return fs.readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesIn(path + '/' + entry.name) : [path + '/' + entry.name]);
}
const files = ['app', 'src/components', 'src/lib', 'components', 'i18n'].flatMap(filesIn).filter(path => /\.(tsx?|json)$/.test(path) && !/\.test\.ts$/.test(path) && !inactiveLocales.some(locale => path.endsWith('/' + locale + '.json')));
const findings = [];
for (const path of files) {
  const source = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : path.endsWith('.json') ? ts.ScriptKind.JSON : ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) {
      let inactive = false;
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isPropertyAssignment(parent) && inactiveLocales.includes(parent.name.text)) inactive = true;
      }
      // Proper geographic names and identifiers/URLs are not interface translations.
      const text = node.text.trim();
      if (!inactive && !/^(?:\/|https?:|Brasília Time — São Paulo$)/.test(text) && portuguese.test(text)) findings.push({ path, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
assert.deepEqual(findings, [], 'Portuguese application copy found in active interface/API strings');
assert.match(fs.readFileSync('i18n/request.ts', 'utf8'), /const locale = "en-US"/);
assert.match(fs.readFileSync('app/[locale]/layout.tsx', 'utf8'), /locale !== "en-US"/);
assert.match(fs.readFileSync('app/(storefront)/videos/[slug]/page.tsx', 'utf8'), /watchLabel="Watch Video"/);
console.log(`PASS: ${files.length} interface, API, helper and active English catalog files audited; no Portuguese matches. Inactive locale dictionaries and proper names preserved.`);

const product = { id: 'local-video', title: 'Client title: vídeo original', slug: 'local-video', description: 'Client description preserved', category: 'Original', priceCents: 100, currency: 'USD', status: 'DRAFT', mediaAssetId: 'media', createdAt: '2026-01-01', updatedAt: '2026-01-01', publishedAt: null };
const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `import React from 'react';import{createRoot}from'react-dom/client';import StoreVideos from './src/components/store/StoreVideos';createRoot(document.getElementById('root')).render(<StoreVideos initialProducts={[${JSON.stringify(product)}]} media={[]}/>);` }, bundle: true, jsx: 'automatic', outfile: 'app.js', write: false, plugins: [{ name: 'local-fixtures', setup(b) {
  b.onResolve({ filter: /next\/link$|UploadManagerProvider$/ }, args => ({ path: args.path, namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.endsWith('UploadManagerProvider') ? 'export const useUploadManager=()=>({uploads:[],isUploading:false});' : "import React from 'react';export default function Link(p){return React.createElement('a',p);}", loader: 'js', resolveDir: process.cwd() }));
} }] });
const server = createServer((req, res) => {
  const asset = bundle.outputFiles.find(file => file.path.replaceAll('\\', '/').endsWith(req.url === '/app.js' ? '/app.js' : req.url === '/app.css' ? '/app.css' : '/no-asset'));
  res.setHeader('Content-Type', req.url === '/app.js' ? 'text/javascript' : req.url === '/app.css' ? 'text/css' : 'text/html');
  res.end(asset ? asset.text : '<link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/account/videos/*/watch', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Administrative access is required.' }) }));
  await page.goto(origin);
  await page.getByRole('button', { name: 'Watch Video', exact: true }).click();
  await page.getByText('Administrative access is required.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), product.title);
  for (const label of ['Title', 'Slug', 'Full Video', 'Price (USD)', 'Category', 'Status']) await page.getByLabel(label, { exact: true }).waitFor();
  assert.equal(await page.locator('form textarea').inputValue(), product.description);
  await page.getByRole('button', { name: 'Save Draft', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Create Product', exact: true }).click();
  assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), '');
  assert.deepEqual(errors, []);
  console.log('PASS: real Watch Video button opens the video modal; English API error renders; Create/Edit labels and Save Draft remain English; client content preserved. Local transport fixture only.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
