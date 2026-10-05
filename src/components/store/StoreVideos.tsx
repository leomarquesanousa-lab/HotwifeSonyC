'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Archive, Check, X, Store } from 'lucide-react';
import { priceLabel } from '@/components/storefront/data';
import type { StoreMedia, StoreProduct } from '@/src/lib/store/types';

type Form = { id?: string; mediaAssetId: string; teaserMediaAssetId: string; thumbnailMediaAssetId: string; title: string; slug: string; description: string; price: string; category: string; featured: boolean; status: string; publishedAt: string };
const emptyForm: Form = { mediaAssetId: '', teaserMediaAssetId: '', thumbnailMediaAssetId: '', title: '', slug: '', description: '', price: '', category: '', featured: false, status: 'DRAFT', publishedAt: '' };
const fieldClass = 'w-full min-w-0 rounded-lg border border-white/15 bg-[#111827] px-3 py-3 text-sm text-white placeholder:text-white/30 focus:outline-2 focus:outline-violet-400';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-50';
function productPayload(product: StoreProduct) {
  return { mediaAssetId: product.mediaAssetId, teaserMediaAssetId: product.teaserMediaAssetId, thumbnailMediaAssetId: product.thumbnailMediaAssetId, title: product.title, slug: product.slug, description: product.description, priceCents: product.priceCents, currency: 'USD', category: product.category, featured: product.featured, status: product.status, publishedAt: product.publishedAt };
}
export default function StoreVideos({ initialProducts, media, locale }: { initialProducts: StoreProduct[]; media: StoreMedia[]; locale: string }) {
  const [products,setProducts] = useState(initialProducts);
  const [form,setForm] = useState<Form | null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const videoMedia = media.filter(item => item.mediaType === 'VIDEO' && item.contentType.startsWith('video/'));
  const imageMedia = media.filter(item => item.mediaType === 'IMAGE' && ['image/jpeg','image/png','image/webp'].includes(item.contentType));
  function update<K extends keyof Form>(key: K, value: Form[K]) { setForm(current => current ? { ...current, [key]: value } : current); }
  function edit(product: StoreProduct) {
    setError('');setNotice('');
    setForm({ id: product.id, mediaAssetId: product.mediaAssetId, teaserMediaAssetId: product.teaserMediaAssetId ?? '', thumbnailMediaAssetId: product.thumbnailMediaAssetId ?? '', title: product.title, slug: product.slug, description: product.description, price: (product.priceCents / 100).toFixed(2), category: product.category, featured: product.featured, status: product.status, publishedAt: product.publishedAt ?? '' });
  }
  async function save(payload: Record<string, unknown>, id?: string) {
    setBusy(true);setError('');setNotice('');
    try {
      const response = await fetch(id ? `/api/store/products/${id}` : '/api/store/products', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save product.');
      setProducts(current => id ? current.map(product => product.id === id ? data.product : product) : [data.product,...current]);
      setForm(null);setNotice('Product saved.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save product.'); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();if (!form) return;
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(form.price);
    if (!match) {setError('Enter a USD price with up to two decimal places.');return;}
    const priceCents = Number(match[1])*100 + Number((match[2] ?? '').padEnd(2,'0'));
    if (!Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 2147483647) {setError('Enter a valid positive price.');return;}
    await save({ mediaAssetId: form.mediaAssetId, teaserMediaAssetId: form.teaserMediaAssetId || null, thumbnailMediaAssetId: form.thumbnailMediaAssetId || null, title: form.title, slug: form.slug, description: form.description, priceCents, currency: 'USD', category: form.category, featured: form.featured, status: form.status, publishedAt: form.publishedAt || null },form.id);
  }
  return <div className="mx-auto max-w-7xl p-4 sm:p-8"><header className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-violet-300"><Store size={16}/> Store</div><h1 className="text-2xl font-semibold">Videos for Sale</h1><p className="mt-2 text-sm text-white/45">Turn existing library videos into products. No new uploads required.</p></div><button className={`${buttonClass} bg-violet-500/20 text-violet-200`} disabled={busy} onClick={() => {setForm({...emptyForm});setError('');setNotice('');}}><Plus size={17}/> Create Product</button></header>
    {error && <p role="alert" className="mb-5 rounded-lg border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}{notice && <p role="status" className="mb-5 text-sm text-emerald-300">{notice}</p>}
    {form && <form onSubmit={submit} className="mb-8 rounded-xl border border-white/10 bg-[#0f1522] p-5 sm:p-7"><div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-medium">{form.id ? 'Edit Product' : 'Create Product'}</h2><button type="button" aria-label="Close product editor" disabled={busy} className={buttonClass} onClick={() => setForm(null)}><X size={17}/></button></div><fieldset disabled={busy} className="grid min-w-0 gap-5 sm:grid-cols-2">
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Title<input className={fieldClass} required maxLength={160} value={form.title} onChange={event => update('title',event.target.value)}/></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Slug<input className={fieldClass} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={160} placeholder="your-video-title" value={form.slug} onChange={event => update('slug',event.target.value)}/></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70 sm:col-span-2">Description<textarea className={fieldClass} required rows={4} maxLength={5000} value={form.description} onChange={event => update('description',event.target.value)}/></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Full Video<select className={fieldClass} required value={form.mediaAssetId} onChange={event => update('mediaAssetId',event.target.value)}><option value="">Select an existing video</option>{videoMedia.map(item => <option key={item.id} value={item.id}>{item.originalFileName}{item.durationSeconds != null ? ` · ${item.durationSeconds}s` : ''}</option>)}</select></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Public Teaser (optional)<select className={fieldClass} value={form.teaserMediaAssetId} onChange={event => update('teaserMediaAssetId',event.target.value)}><option value="">No teaser</option>{videoMedia.filter(item => item.id !== form.mediaAssetId).map(item => <option key={item.id} value={item.id}>{item.originalFileName}</option>)}</select><span className="text-white/40">The selected teaser will be publicly playable in full.</span></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Cover Image<select className={fieldClass} value={form.thumbnailMediaAssetId} onChange={event => update('thumbnailMediaAssetId',event.target.value)}><option value="">Use video thumbnail or default artwork</option>{imageMedia.map(item => <option key={item.id} value={item.id}>{item.originalFileName}</option>)}</select></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Price (USD)<input className={fieldClass} inputMode="decimal" placeholder="19.99" required value={form.price} onChange={event => update('price',event.target.value)}/></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Category<input className={fieldClass} required maxLength={80} value={form.category} onChange={event => update('category',event.target.value)}/></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Status<select className={fieldClass} value={form.status} onChange={event => update('status',event.target.value)}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Publish Date (UTC, optional)<input className={fieldClass} type="datetime-local" value={form.publishedAt ? form.publishedAt.slice(0,16) : ''} onChange={event => update('publishedAt',event.target.value ? new Date(event.target.value+'Z').toISOString() : '')}/><span className="text-white/40">Leave blank to publish now. Future dates keep the product hidden until then.</span></label>
      <label className="flex min-h-11 items-center gap-3 self-center text-sm"><input type="checkbox" checked={form.featured} onChange={event => update('featured',event.target.checked)}/> Featured on the storefront</label>
      <div className="flex flex-wrap gap-3 sm:col-span-2"><button className={`${buttonClass} bg-violet-500/25 text-violet-200`} type="submit">{busy ? 'Saving...' : 'Save Product'}</button><button type="button" className={buttonClass} onClick={() => setForm(null)}>Cancel</button></div>
    </fieldset></form>}
    {!products.length ? <div className="rounded-xl border border-white/10 p-10 text-center"><h2 className="text-lg">Your store starts here.</h2><p className="mt-2 text-sm text-white/45">Create a product using a video already in your library.</p><Link href={`/app/media`} className="mt-5 inline-block text-sm text-violet-300">Open Media Library</Link></div> : <div className="grid gap-4">{products.map(product => <article key={product.id} className="flex min-w-0 flex-wrap gap-5 rounded-xl border border-white/10 bg-[#101623] p-5"><img src={`/api/store/products/${product.id}/thumbnail?v=${encodeURIComponent(product.updatedAt)}`} alt={`Cover for ${product.title}`} className="h-24 w-36 rounded-lg object-cover"/><div className="min-w-0 flex-1 basis-52"><div className="flex flex-wrap items-center gap-3"><h2 className="break-words text-lg font-medium">{product.title}</h2><span className="rounded bg-white/5 px-2 py-1 text-[10px]">{product.status}</span>{product.featured && <span className="text-xs text-violet-300">Featured</span>}</div><p className="mt-2 text-sm text-violet-200">{priceLabel(product.priceCents,product.currency)} · {product.category}</p><p className="mt-2 break-all text-xs text-white/40">Video: {media.find(item => item.id === product.mediaAssetId)?.originalFileName ?? 'Unavailable'}<br/>Teaser: {product.teaserMediaAssetId ? media.find(item => item.id === product.teaserMediaAssetId)?.originalFileName ?? 'Unavailable' : 'None'}</p><p className="mt-2 text-xs text-white/40">/{product.slug}{product.publishedAt && new Date(product.publishedAt).getTime() > Date.now() ? ' · Scheduled' : ''}</p></div><div className="flex flex-wrap items-center gap-2"><button className={buttonClass} disabled={busy} onClick={() => edit(product)}><Pencil size={15}/> Edit</button>{product.status !== 'PUBLISHED' && <button className={`${buttonClass} text-emerald-300`} disabled={busy} onClick={() => void save({...productPayload(product),status:'PUBLISHED',publishedAt:null},product.id)}><Check size={15}/> Publish</button>}{product.status !== 'ARCHIVED' && <button className={`${buttonClass} text-white/55`} disabled={busy} onClick={() => void save({...productPayload(product),status:'ARCHIVED'},product.id)}><Archive size={15}/> Archive</button>}{product.status === 'PUBLISHED' && <Link className={buttonClass} href={`/videos/${product.slug}`}>View</Link>}</div></article>)}</div>}
  </div>;
}
