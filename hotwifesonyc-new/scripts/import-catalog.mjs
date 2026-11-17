import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const rows = readFileSync(new URL('reference/catalog/transcription.tsv', root), 'utf8').trimEnd().split(/\r?\n/).slice(1);
const catalog = rows.map(row => {
  const [number, title, participantsRaw, duration, sourcePage, reviewNotes = ''] = row.split('\t');
  return { id: `sony-${number.padStart(3, '0')}`, number: Number(number), title, participantsRaw, participants: participantsRaw === '—' ? [] : participantsRaw.split(/, | \+ /), duration, sourcePage: Number(sourcePage), platformUrl: null, status: Number(number) === 68 ? 'inactive' : reviewNotes ? 'review' : 'active', reviewNotes, checkedAgainstSource: true };
});
if (catalog.length !== 134 || catalog.some((v,i) => v.number !== i+1)) throw new Error('Expected unique sequential records 1–134');
writeFileSync(new URL('content/catalog.json', root), JSON.stringify(catalog,null,2)+'\n');
const sources = Array.from({length:6},(_,i) => { const file = `VideoListMasterPage${i+1}.jpg`; return {file,sha256:createHash('sha256').update(readFileSync(new URL(`reference/catalog/${file}`,root))).digest('hex')}; });
const report = { total: catalog.length, first:1, last:134, duplicates:[], missing:[], sourceFiles:sources, checkedRecords:catalog.filter(v=>v.checkedAgainstSource).length, requiresReview:catalog.filter(v=>v.reviewNotes).map(v=>({number:v.number,status:v.status,notes:v.reviewNotes})), note:'Visual transcription checked against supplied images. Flagged fields remain unresolved and are excluded from public display. Entry 68 is excluded by the source itself. No descriptions, covers or external links were invented.' };
writeFileSync(new URL('docs/catalog-import-report.json',root), JSON.stringify(report,null,2)+'\n');
console.log(`Imported ${catalog.length}; ${catalog.filter(v=>v.status==='active').length} active; ${report.requiresReview.length} require manual review.`);
