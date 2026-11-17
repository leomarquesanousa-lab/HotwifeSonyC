import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
const root = process.cwd();
export function validateContent(site, catalog, assetExists = path => existsSync(join(root,`public${path}`))) {
  const fail = message => { throw new Error(message); };
  const text = (value, field, allowEmpty = false) => { if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > 12000) fail(`Invalid ${field}`); };
  const image = value => { if (typeof value !== 'string' || !/^\/images\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|avif)$/i.test(value) || !assetExists(value)) fail(`Invalid or missing image: ${value}`); };
  const url = value => { if (value === null) return; if(typeof value !== 'string' || value.length > 2048) fail('Invalid platform URL'); let parsed; try { parsed = new URL(value); } catch { fail('Invalid platform URL'); } if (parsed.protocol !== 'https:' || parsed.username || parsed.password || /\.(mp4|webm|mov|m3u8)$/i.test(parsed.pathname) || !['onlyfans.com','fansly.com','clips4sale.com','www.clips4sale.com','manyvids.com','www.manyvids.com'].includes(parsed.hostname)) fail('Use an official HTTPS OnlyFans, Fansly, Clips4Sale or ManyVids page'); };
  const unique = (list, field) => { if (!Array.isArray(list)) fail(`Invalid ${field} list`); const ids = new Set(); for (const item of list) { if(!item || typeof item !== 'object') fail(`Invalid ${field}`); text(item.id, `${field} id`); if (ids.has(item.id)) fail(`Duplicate ${field} id`); ids.add(item.id); } };
  const boolean = (value, field) => { if(typeof value !== 'boolean') fail(`Invalid ${field}`); };
  if (!site || site.slogan !== 'One Vision. Endless Stories') fail('Keep the exact slogan');
  text(site.name,'name'); text(site.introduction,'introduction');
  if (site.biography !== null) text(site.biography, 'biography');
  for (const photo of [site.hero, site.portrait]) { image(photo.image); text(photo.alt, 'photo alt'); }
  unique(site.platforms, 'platform'); unique(site.picks, 'pick'); unique(catalog, 'catalog');
  for (const platform of site.platforms) { text(platform.name, 'platform name'); text(platform.label, 'platform label'); url(platform.url); boolean(platform.active,'platform active'); }
  for (const pick of site.picks) { image(pick.image); text(pick.alt, 'pick alt'); text(pick.title,'pick title',true); text(pick.description,'pick description',true); url(pick.url); boolean(pick.active,'pick active'); if (!Number.isFinite(pick.order)) fail('Invalid pick order'); }
  const numbers = new Set();
  if (catalog.length > 10000) fail('Catalog too large');
  for (const entry of catalog) {
    if(!Number.isSafeInteger(entry.number) || entry.number < 1 || numbers.has(entry.number)) fail('Invalid or duplicate video number'); numbers.add(entry.number);
    text(entry.title,'title'); text(entry.participantsRaw,'participants'); text(entry.reviewNotes,'review notes',true);
    if (!Array.isArray(entry.participants) || entry.participants.some(p=>typeof p !== 'string' || !p.trim())) fail('Invalid participants');
    if(typeof entry.duration !== 'string' || !/^(—|\d{1,3}:[0-5]\d(?: \+ \d{1,3}:[0-5]\d)*)$/.test(entry.duration)) fail('Invalid duration; preserve — for missing values');
    if(!Number.isInteger(entry.sourcePage) || entry.sourcePage < 0 || entry.sourcePage > 6) fail('Invalid source page');
    if(!['active','inactive','review'].includes(entry.status)) fail('Invalid display status');
    boolean(entry.checkedAgainstSource,'source verification');
    if(entry.status === 'active' && (!entry.checkedAgainstSource || entry.reviewNotes.trim())) fail('Resolve review notes and verify source before activation');
    url(entry.platformUrl);
    const allowed = ['id','number','title','participantsRaw','participants','duration','sourcePage','platformUrl','status','reviewNotes','checkedAgainstSource'];
    if(Object.keys(entry).some(key=>!allowed.includes(key))) fail('Unexpected catalog field; media and commerce are not supported');
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const catalog = JSON.parse(readFileSync(join(root,'content/catalog.json'),'utf8'));
  validateContent(JSON.parse(readFileSync(join(root,'content/site.json'),'utf8')),catalog);
  console.log(`Content valid: ${catalog.length} records; ${catalog.filter(v=>v.status==='review').length} pending review. Platform links and biography validated.`);
}
