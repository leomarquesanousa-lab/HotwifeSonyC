import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Read on every page request; no generated manifest or fallback photographs.
export async function readCreatorPicks(excludedImages = [], root = process.cwd()) {
  const directory = join(root, 'public/images/creator-picks');
  let files;
  try { files = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  let settings = {};
  try { settings = JSON.parse(await readFile(join(root, 'content/creator-picks.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const excluded = new Set(await Promise.all(excludedImages.map(path => readFile(join(root, 'public', path.replace(/^\//, ''))).then(hash))));
  const photos = [];
  for (const file of files.filter(file => file.isFile() && /\.(jpe?g|png|webp)$/i.test(file.name)).sort((a,b) => a.name.localeCompare(b.name, 'en', {numeric:true}))) {
    if (excluded.has(hash(await readFile(join(directory, file.name))))) continue;
    const entry = settings[file.name] ?? {};
    const focal = entry.focal ?? [50, 30];
    if (!Array.isArray(focal) || focal.length !== 2 || focal.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100)) throw new Error(`Invalid focal point for ${file.name}`);
    photos.push({src:`/images/creator-picks/${encodeURIComponent(file.name)}`, name:file.name, alt:typeof entry.alt === 'string' && entry.alt.trim() ? entry.alt : `Sony C — Creator Picks photograph ${photos.length + 1}`, position:`${focal[0]}% ${focal[1]}%`});
  }
  return photos;
}
