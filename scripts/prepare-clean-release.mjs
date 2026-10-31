// Local packaging only. Never deploys, runs cron, reads private media or changes originals.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', ['-c', 'core.safecrlf=false', ...args], { cwd: root, encoding: 'utf8' }).trim().split('\0').filter(Boolean);
const assets = new Set(JSON.parse(fs.readFileSync(path.join(root, 'release-public-assets.json'), 'utf8')).publicAssets);
const forbiddenImage = 'hero1_old (2).jpeg';
if (assets.has(forbiddenImage)) throw new Error('Unreviewed image cannot be included in a release.');
const approvedNew = new Set(['release-public-assets.json', 'scripts/prepare-clean-release.mjs', 'scripts/test-release-cron.mjs', 'scripts/test-logo-navigation.mjs', 'scripts/test-media-delete-ui.mjs', 'scripts/test-media-delete.mjs', 'scripts/test-media-upload.mjs', 'scripts/test-simplified-publication.mjs', 'scripts/test-store-purchase.mjs']);
const tracked = git('ls-files', '-z');
const candidates = [...new Set([...tracked, ...git('ls-files', '--others', '--exclude-standard', '-z').filter(name => approvedNew.has(name))])];
const excluded = [], files = [];
for (const name of candidates) {
  const normalized = name.replaceAll('\\', '/');
  if (/^(?:\.git|\.runtime|\.wrangler|\.vinext|\.next|node_modules|dist|debug|docs|\.agents|\.claude|\.cursor|\.devin|\.codex|\.aws|\.manyvids-browser-profile)\//.test(normalized)
    || /(?:^|\/)\.env(?:\.|$)|\.(?:pem|pfx|p12|db|sqlite|pdf|mp4|mov|m4v|webm|zip|tgz|tar\.gz)$/i.test(normalized)
    || /^(?:public\/)hero1_old \(2\)\.jpeg$/.test(normalized)
    || (normalized.startsWith('public/') && !assets.has(normalized.slice(7)))
    || (/\.(?:jpe?g|jfif|png|gif|webp|ico)$/i.test(normalized) && !normalized.startsWith('public/') && !['app/icon.png', 'app/apple-icon.png', 'app/favicon.ico'].includes(normalized))) {
    excluded.push(normalized); continue;
  }
  const absolute = path.resolve(root, normalized);
  if (!absolute.startsWith(root + path.sep) || fs.lstatSync(absolute).isSymbolicLink()) throw new Error('Unsafe package path.');
  files.push(normalized);
}
// Scan text for known secrets and private signed URLs without printing any values.
const secretValues = fs.existsSync(path.join(root, '.env')) ? fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/).flatMap(line => {
  const m = line.match(/^\s*(\w+)\s*=\s*(.*)$/);
  if (!m || !/(SECRET|TOKEN|PASSWORD|DATABASE_URL|PRIVATE_KEY|ACCESS_KEY)/i.test(m[1])) return [];
  const value = m[2].replace(/^["']|["']$/g, '').trim(); return value.length >= 12 ? [value] : [];
}) : [];
for (const name of files) {
  if (!/\.(?:tsx?|mjs|cjs|js|jsonc?|md|css|svg|txt|sql|prisma)$/.test(name)) continue;
  const text = fs.readFileSync(path.join(root, name), 'utf8');
  if (secretValues.some(value => text.includes(value)) || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|https?:\/\/[^\s"'<>]+[?&]X-Amz-Signature=[a-f0-9]{32,}/i.test(text)) throw new Error('Sensitive content detected in package candidate: ' + name);
  if (name.endsWith('.svg') && /<(?:image|foreignObject)\b|data:image/i.test(text)) throw new Error('Embedded SVG media needs review: ' + name);
}
const base = path.join(root, '.runtime', 'clean-release'); fs.mkdirSync(base, { recursive: true });
const destination = fs.mkdtempSync(path.join(base, 'source-'));
const manifest = [];
for (const name of files.sort()) {
  const target = path.join(destination, name); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, name), target);
  manifest.push({ path: name, sha256: createHash('sha256').update(fs.readFileSync(target)).digest('hex') });
}
const result = { source: destination, files: manifest, excluded, publicAssets: [...assets].sort(), cronDisabled: true };
fs.writeFileSync(path.join(base, 'manifest.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ source: destination, includedFiles: files.length, excludedFiles: excluded.length, publicAssets: [...assets], originalImagePreserved: fs.existsSync(path.join(root, 'public', forbiddenImage)) }, null, 2));
