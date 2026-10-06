'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Archive, Check, X, Store } from 'lucide-react';
import { formatPublishDate, parsePublishDate } from '@/src/lib/store/product-fields';
import { priceLabel } from '@/components/storefront/data';
import { useUploadManager } from '@/src/components/app/UploadManagerProvider';
import type { StoreMedia, StoreProduct } from '@/src/lib/store/types';

type Form = { id?: string; mediaAssetId: string; teaserMediaAssetId: string; thumbnailMediaAssetId: string; title: string; slug: string; description: string; price: string; category: string; featured: boolean; status: string; publishedAt: string };
const emptyForm: Form = { mediaAssetId: '', teaserMediaAssetId: '', thumbnailMediaAssetId: '', title: '', slug: '', description: '', price: '', category: '', featured: false, status: 'DRAFT', publishedAt: '' };
function slugFromTitle(title: string) {
  return title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}
const fieldClass = 'w-full min-w-0 rounded-lg border border-white/15 bg-[#111827] px-3 py-3 text-sm text-white placeholder:text-white/30 focus:outline-2 focus:outline-violet-400';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-50';
type UploadKey = 'mediaAssetId' | 'teaserMediaAssetId' | 'thumbnailMediaAssetId';
function ProductUpload({ label, accept, fileName, disabled, progress, onFile, onRemove, help }: {
  label: string; accept: string; fileName?: string; disabled: boolean; progress?: number;
  onFile: (file: File) => void; onRemove?: () => void; help?: string;
}) {
  return <div className="grid min-w-0 gap-2 text-xs text-white/70">
    <label className={`grid gap-3 rounded-lg border border-dashed border-white/20 p-4 ${disabled ? 'opacity-50' : 'cursor-pointer hover:border-violet-400'}`}
      onDragOver={event => event.preventDefault()}
      onDrop={event => { event.preventDefault(); if (!disabled && event.dataTransfer.files[0]) onFile(event.dataTransfer.files[0]); }}>
      <span>{label}</span><span className="break-all text-white/45">{fileName ?? 'Drag and drop a file, or select one below.'}</span>
      <input type="file" aria-label={label} accept={accept} disabled={disabled} className="w-full min-w-0 text-xs" onChange={event => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ''; }}/>
      {progress !== undefined && <span role="status">Uploading… {progress}%</span>}
    </label>
    {onRemove && <button type="button" disabled={disabled} className="justify-self-start text-white/45" onClick={onRemove}>Remove from product</button>}
    {help && <span className="text-white/40">{help}</span>}
  </div>;
}
function productPayload(product: StoreProduct) {
  return { title: product.title, slug: product.slug, description: product.description, priceCents: product.priceCents, currency: 'USD', category: product.category, featured: product.featured, status: product.status, publishedAt: product.publishedAt };
}
export default function StoreVideos({ initialProducts, media: initialMedia, locale }: { initialProducts: StoreProduct[]; media: StoreMedia[]; locale: string }) {
  const [products,setProducts] = useState(initialProducts);
  const [media,setMedia] = useState(initialMedia);
  const { uploadProductFile, uploads, isUploading } = useUploadManager();
  const [uploadingField,setUploadingField] = useState<UploadKey | null>(null);
  const [form,setForm] = useState<Form | null>(null);
  const [slugEdited,setSlugEdited] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const locked = busy || isUploading;
  const activeUpload = [...uploads].reverse().find(item => ['STARTING','UPLOADING','COMPLETING'].includes(item.status));
  async function upload(key: UploadKey, file: File) {
    const allowed = key === 'thumbnailMediaAssetId' ? ['image/jpeg','image/png','image/webp'] : ['video/mp4','video/quicktime','video/x-m4v'];
    if (!allowed.includes(file.type)) { setError(key === 'thumbnailMediaAssetId' ? 'Choose a JPG, PNG, or WebP image.' : 'Choose an MP4, MOV, or M4V video.'); return; }
    setError(''); setUploadingField(key);
    try {
      const id = await uploadProductFile(file);
      setMedia(current => [...current, {id, originalFileName: file.name, mediaType: file.type.startsWith('image/') ? 'IMAGE' : 'VIDEO', contentType: file.type, durationSeconds: null}]);
      update(key,id);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to upload file.'); }
    finally { setUploadingField(null); }
  }
  function update<K extends keyof Form>(key: K, value: Form[K]) { setForm(current => current ? { ...current, [key]: value } : current); }
  function updateTitle(title: string) {
    setForm(current => current ? { ...current, title, slug: slugEdited ? current.slug : slugFromTitle(title) } : current);
  }
  function edit(product: StoreProduct) {
    setError('');setNotice('');
    setSlugEdited(true);
    setForm({ id: product.id, mediaAssetId: product.mediaAssetId, teaserMediaAssetId: product.teaserMediaAssetId ?? '', thumbnailMediaAssetId: product.thumbnailMediaAssetId ?? '', title: product.title, slug: product.slug, description: product.description, price: (product.priceCents / 100).toFixed(2), category: product.category, featured: product.featured, status: product.status, publishedAt: formatPublishDate(product.publishedAt) });
  }
  async function save(payload: Record<string, unknown>, id?: string) {
    setBusy(true);setError('');setNotice('');
    try {
      console.info('STORE_PRODUCT_FETCH', {
        titlePresent: typeof payload.title === 'string' && Boolean(payload.title.trim()),
        slugPresent: typeof payload.slug === 'string' && Boolean(payload.slug.trim()),
        fullVideoId: payload.mediaAssetId,
        teaserId: payload.teaserMediaAssetId,
        coverId: payload.thumbnailMediaAssetId,
        category: payload.category,
        status: payload.status,
        reachedFetch: true,
      });
      const response = await fetch(id ? `/api/store/products/${id}` : '/api/store/products', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save product.');
      setProducts(current => id ? current.map(product => product.id === id ? data.product : product) : [data.product,...current]);
      setForm(null);setNotice('Product saved.');
      window.dispatchEvent(new CustomEvent('creator-platform:media-updated'));
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save product.'); }
    finally { setBusy(false); }
  }
  function logBlockedSubmit() {
    console.info('STORE_PRODUCT_SUBMIT_BLOCKED', {
      titlePresent: Boolean(form?.title.trim()), slugPresent: Boolean(form?.slug.trim()),
      fullVideoId: form?.mediaAssetId || null, teaserId: form?.teaserMediaAssetId || null,
      coverId: form?.thumbnailMediaAssetId || null, category: form?.category,
      status: form?.status, reachedFetch: false,
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form || locked) { logBlockedSubmit(); setError(locked ? 'Wait for the current upload or save to finish.' : 'Open the product editor before saving.'); return; }
    if (!form.mediaAssetId) { logBlockedSubmit(); setError('Upload the full video before saving.'); return; }
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const publish = submitter instanceof HTMLButtonElement && submitter.value === 'PUBLISHED';
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(form.price);
    if (!match) {logBlockedSubmit();setError('Enter a USD price with up to two decimal places.');return;}
    const priceCents = Number(match[1])*100 + Number((match[2] ?? '').padEnd(2,'0'));
    if (!Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 2147483647) {logBlockedSubmit();setError('Enter a valid positive price.');return;}
    if (form.publishedAt && !parsePublishDate(form.publishedAt)) { setError('Enter a valid date in MM/DD/YYYY format.'); return; }
    const existing = products.find(product => product.id === form.id);
    const mediaChanges: Partial<Record<UploadKey, string>> = {};
    for (const key of ['mediaAssetId', 'teaserMediaAssetId', 'thumbnailMediaAssetId'] as const) {
      if (form[key] && (!form.id || form[key] !== existing?.[key])) mediaChanges[key] = form[key];
    }
    // Preserve the original instant when the calendar date is untouched.
    const dateChanges = existing && form.publishedAt === formatPublishDate(existing.publishedAt)
      ? {} : { publishedAt: form.publishedAt || null };
    await save({ ...mediaChanges, ...dateChanges, title: form.title, slug: form.slug, description: form.description, priceCents, currency: 'USD', category: form.category, featured: form.featured, status: publish ? 'PUBLISHED' : form.status },form.id);
  }
  return <div className="mx-auto max-w-7xl p-4 sm:p-8"><header className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-violet-300"><Store size={16}/> Store</div><h1 className="text-2xl font-semibold">Videos for Sale</h1><p className="mt-2 text-sm text-white/45">Create and publish videos with direct uploads. Your files are automatically added to the Media Library.</p></div><button className={`${buttonClass} bg-violet-500/20 text-violet-200`} disabled={locked} onClick={() => {setSlugEdited(false);setForm({...emptyForm});setError('');setNotice('');}}><Plus size={17}/> Create Product</button></header>
    {error && <p role="alert" className="mb-5 rounded-lg border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}{notice && <p role="status" className="mb-5 text-sm text-emerald-300">{notice}</p>}
    {form && <form onSubmit={submit} onInvalidCapture={event => {
      const field = event.target;
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        const label = field.closest('label')?.firstChild?.textContent?.trim() || 'Required field';
        setError(label + ': ' + field.validationMessage);
        logBlockedSubmit();
      }
    }} className="mb-8 rounded-xl border border-white/10 bg-[#0f1522] p-5 sm:p-7"><div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-medium">{form.id ? 'Edit Product' : 'Create Product'}</h2><button type="button" aria-label="Close product editor" disabled={locked} className={buttonClass} onClick={() => setForm(null)}><X size={17}/></button></div><fieldset disabled={locked} className="grid min-w-0 gap-5 sm:grid-cols-2">
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Title<input className={fieldClass} required maxLength={160} value={form.title} onChange={event => updateTitle(event.target.value)}/></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Slug<input className={fieldClass} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={160} placeholder="your-video-title" value={form.slug} onChange={event => { setSlugEdited(true); update('slug',event.target.value); }}/></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70 sm:col-span-2">Description<textarea className={fieldClass} required rows={4} maxLength={5000} value={form.description} onChange={event => update('description',event.target.value)}/></label>
      <ProductUpload label="Full Video" accept="video/mp4,video/quicktime,video/x-m4v" fileName={media.find(item => item.id === form.mediaAssetId)?.originalFileName} disabled={locked} progress={uploadingField === 'mediaAssetId' ? activeUpload?.progress ?? 0 : undefined} onFile={file => void upload('mediaAssetId',file)}/>
      <ProductUpload label="Teaser (optional)" accept="video/mp4,video/quicktime,video/x-m4v" fileName={media.find(item => item.id === form.teaserMediaAssetId)?.originalFileName} disabled={locked} progress={uploadingField === 'teaserMediaAssetId' ? activeUpload?.progress ?? 0 : undefined} onFile={file => void upload('teaserMediaAssetId',file)} help="The teaser will be publicly playable in full."/>
      <ProductUpload label="Cover Image (optional)" accept="image/jpeg,image/png,image/webp" fileName={media.find(item => item.id === form.thumbnailMediaAssetId)?.originalFileName} disabled={locked} progress={uploadingField === 'thumbnailMediaAssetId' ? activeUpload?.progress ?? 0 : undefined} onFile={file => void upload('thumbnailMediaAssetId',file)} help="Without a cover, the video thumbnail or default artwork is used."/>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Price (USD)<input className={fieldClass} inputMode="decimal" placeholder="19.99" required value={form.price} onChange={event => update('price',event.target.value)}/></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Category<input className={fieldClass} required maxLength={80} value={form.category} onChange={event => update('category',event.target.value)}/></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Status<select className={fieldClass} value={form.status} onChange={event => update('status',event.target.value)}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70">Publish Date (MM/DD/YYYY, optional)<input className={fieldClass} type="text" inputMode="numeric" placeholder="MM/DD/YYYY" maxLength={10} pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" value={form.publishedAt} onChange={event => update('publishedAt',event.target.value)}/><span className="text-white/40">Dates start at midnight UTC. Leave blank to publish now.</span></label>
      <label className="flex min-h-11 items-center gap-3 self-center text-sm"><input type="checkbox" checked={form.featured} onChange={event => update('featured',event.target.checked)}/> Featured on the storefront</label>
      <div className="flex flex-wrap gap-3 sm:col-span-2"><button className={`${buttonClass} bg-violet-500/25 text-violet-200`} type="submit">{busy ? 'Saving...' : 'Save'}</button><button className={`${buttonClass} text-emerald-300`} type="submit" value="PUBLISHED">Publish</button><button type="button" className={buttonClass} onClick={() => setForm(null)}>Cancel</button></div>
    </fieldset></form>}
    {!products.length ? <div className="rounded-xl border border-white/10 p-10 text-center"><h2 className="text-lg">Your store starts here.</h2><p className="mt-2 text-sm text-white/45">Click Create Product to upload your video and prepare it for sale.</p></div> : <div className="grid gap-4">{products.map(product => <article key={product.id} className="flex min-w-0 flex-wrap gap-5 rounded-xl border border-white/10 bg-[#101623] p-5"><img src={`/api/store/products/${product.id}/thumbnail?v=${encodeURIComponent(product.updatedAt)}`} alt={`Cover for ${product.title}`} className="h-24 w-36 rounded-lg object-cover"/><div className="min-w-0 flex-1 basis-52"><div className="flex flex-wrap items-center gap-3"><h2 className="break-words text-lg font-medium">{product.title}</h2><span className="rounded bg-white/5 px-2 py-1 text-[10px]">{product.status}</span>{product.featured && <span className="text-xs text-violet-300">Featured</span>}</div><p className="mt-2 text-sm text-violet-200">{priceLabel(product.priceCents,product.currency)} · {product.category}</p><p className="mt-2 break-all text-xs text-white/40">Video: {media.find(item => item.id === product.mediaAssetId)?.originalFileName ?? 'Unavailable'}<br/>Teaser: {product.teaserMediaAssetId ? media.find(item => item.id === product.teaserMediaAssetId)?.originalFileName ?? 'Unavailable' : 'None'}</p><p className="mt-2 text-xs text-white/40">/{product.slug}{product.publishedAt && new Date(product.publishedAt).getTime() > Date.now() ? ' · Scheduled' : ''}</p></div><div className="flex flex-wrap items-center gap-2"><button className={buttonClass} disabled={locked} onClick={() => edit(product)}><Pencil size={15}/> Edit</button>{product.status !== 'PUBLISHED' && <button className={`${buttonClass} text-emerald-300`} disabled={locked} onClick={() => void save({...productPayload(product),status:'PUBLISHED',publishedAt:null},product.id)}><Check size={15}/> Publish</button>}{product.status !== 'ARCHIVED' && <button className={`${buttonClass} text-white/55`} disabled={locked} onClick={() => void save({...productPayload(product),status:'ARCHIVED'},product.id)}><Archive size={15}/> Archive</button>}{product.status === 'PUBLISHED' && <Link className={buttonClass} href={`/videos/${product.slug}`}>View</Link>}</div></article>)}</div>}
  </div>;
}
