'use client';
import Link from 'next/link';
import WatchFullVideo from '@/components/storefront/WatchFullVideo';
import DeleteVideoDialog from './DeleteVideoDialog';
import PermanentlyDeleteVideo from './PermanentlyDeleteVideo';
import { useRef, useState, type FormEvent } from 'react';
import { Plus, Pencil, Archive, Check, X, Store, Trash2 } from 'lucide-react';
import { priceLabel } from '@/components/storefront/data';
import { useUploadManager } from '@/src/components/app/UploadManagerProvider';
import type { StoreMedia, StoreProduct } from '@/src/lib/store/types';

type Form = { id?: string; mediaAssetId: string; teaserMediaAssetId: string; thumbnailMediaAssetId: string; title: string; slug: string; description: string; price: string; category: string; featured: boolean; status: string };
const emptyForm: Form = { mediaAssetId: '', teaserMediaAssetId: '', thumbnailMediaAssetId: '', title: '', slug: '', description: '', price: '', category: 'Original', featured: false, status: 'DRAFT' };
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
function formFromProduct(product: StoreProduct): Form {
  return { id: product.id, mediaAssetId: product.mediaAssetId, teaserMediaAssetId: product.teaserMediaAssetId ?? '', thumbnailMediaAssetId: product.thumbnailMediaAssetId ?? '', title: product.title, slug: product.slug, description: product.description, price: (product.priceCents / 100).toFixed(2), category: product.category, featured: product.featured, status: product.status };
}
export default function StoreVideos({ initialProducts, media: initialMedia, canDelete = false, initialMediaId }: { initialProducts: StoreProduct[]; media: StoreMedia[]; canDelete?: boolean; initialMediaId?: string; }) {
  const requestInFlight = useRef(false);
  const [products,setProducts] = useState(initialProducts);
  const [listFilter, setListFilter] = useState('ACTIVE');
  const visibleProducts = products.filter(product => listFilter === 'ALL' || (listFilter === 'ARCHIVED' ? product.status === 'ARCHIVED' : product.status !== 'ARCHIVED'));
  const [media,setMedia] = useState(initialMedia);
  const { uploadProductFile, uploads, isUploading } = useUploadManager();
  const [uploadingField,setUploadingField] = useState<UploadKey | null>(null);
  const [form,setForm] = useState<Form | null>(() => {
    if (!initialMediaId) return null;
    const product = initialProducts.filter(product => product.mediaAssetId === initialMediaId).sort((a,b) => Number(b.status === 'PUBLISHED') - Number(a.status === 'PUBLISHED'))[0];
    if (product) return formFromProduct(product);
    const media = initialMedia.find(media => media.id === initialMediaId && media.mediaType === 'VIDEO');
    if (!media || initialProducts.some(product => product.teaserMediaAssetId === initialMediaId)) return null;
    const title = media.originalFileName.replace(/\.[^.]+$/, '');
    return { ...emptyForm, mediaAssetId: media.id, title, slug: slugFromTitle(title) };
  });
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState(() => initialMediaId && (!initialMedia.some(media => media.id === initialMediaId && media.mediaType === 'VIDEO') || (!initialProducts.some(product => product.mediaAssetId === initialMediaId) && initialProducts.some(product => product.teaserMediaAssetId === initialMediaId))) ? 'O vídeo não está disponível para venda neste workspace ou já é usado como teaser público.' : '');
  const [notice,setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<StoreProduct | null>(null);
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
        if (key === 'mediaAssetId') setForm(current => current && !current.title ? { ...current, title: file.name.replace(/\.[^.]+$/, ''), slug: slugFromTitle(file.name.replace(/\.[^.]+$/, '')) } : current);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to upload file.'); }
    finally { setUploadingField(null); }
  }
  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm(current => current ? { ...current, [key]: value } : current);
  }
  function updateTitle(title: string) {
    setForm(current => current ? { ...current, title, slug: current.id ? current.slug : slugFromTitle(title) } : current);
  }
  function edit(product: StoreProduct) {
    setError('');setNotice('');

    setForm(formFromProduct(product));
  }
  async function save(payload: Record<string, unknown>, id?: string, keepEditor = false) {
    if (requestInFlight.current) return null;
    requestInFlight.current = true;
    setBusy(true);setError('');setNotice('');
    try {
      const response = await fetch(id ? `/api/store/products/${id}` : '/api/store/products', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save product.');
      setProducts(current => id ? current.map(product => product.id === id ? data.product : product) : [data.product,...current]);
      if (keepEditor) setForm(current => current ? { ...current, id: data.product.id, description: current.description.trim() || data.product.description } : current);
      else setForm(null);
      setNotice(payload.status === 'PUBLISHED' ? 'Published in the catalog. Checkout is not available yet.' : payload.status === 'DRAFT' ? (id && products.some(product => product.id === id && product.status === 'PUBLISHED') ? 'Unpublished. Existing purchases are preserved.' : 'Draft saved.') : 'Video removed from sale. Existing purchases are preserved.');
      window.dispatchEvent(new CustomEvent('creator-platform:media-updated'));
      return data.product as StoreProduct;
    } catch (failure) {
      if (!form && id) { const product = products.find(product => product.id === id); if (product) edit(product); }
      setError(failure instanceof TypeError ? 'The server could not be reached. Your form is preserved; check your connection and retry.' : failure instanceof Error ? failure.message : 'The request could not be completed. Your form is preserved; retry or check the server connection.');
      return null;
    }
    finally { requestInFlight.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form || locked) {  setError(locked ? 'Wait for the current upload or save to finish.' : 'Open the product editor before saving.'); return; }
    if (!form.mediaAssetId) {  setError('Upload the full video before saving.'); return; }

    if (!form.thumbnailMediaAssetId) { setError('Cover not uploaded. Add a cover below before publishing.'); return; }
    if (!form.teaserMediaAssetId) { setError('Teaser not uploaded. Add a teaser below before publishing.'); return; }
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(form.price);
    if (!match) {setError('Enter a USD price with up to two decimal places.');return;}
    const priceCents = Number(match[1])*100 + Number((match[2] ?? '').padEnd(2,'0'));
    if (!Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 2147483647) {setError('Enter a valid positive price.');return;}

    const existing = products.find(product => product.id === form.id);
    const mediaChanges: Partial<Record<UploadKey, string>> = {};
    for (const key of ['mediaAssetId', 'teaserMediaAssetId', 'thumbnailMediaAssetId'] as const) {
      if (form[key] && (!form.id || form[key] !== existing?.[key])) mediaChanges[key] = form[key];
    }
    const payload = { ...mediaChanges, title: form.title, slug: form.slug, description: form.description.trim() || form.title.trim(), priceCents, currency: 'USD', category: form.category, featured: form.featured, status: 'PUBLISHED' };
    let productId = form.id;
    if (!productId) {
      const draft = await save({ ...payload, status: 'DRAFT' }, undefined, true);
      if (!draft) return;
      productId = draft.id;
    }
    await save(payload, productId);
  }
  return <div className="mx-auto max-w-7xl p-4 sm:p-8"><header className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-violet-300"><Store size={16}/> Store</div><h1 className="text-2xl font-semibold">Videos for Sale</h1><p className="mt-2 text-sm text-white/45">Upload, set the price and publish from this screen. Catalog publication prepares your video for sale; checkout is not available yet.</p></div><button className={`${buttonClass} bg-violet-500/20 text-violet-200`} disabled={locked} onClick={() => {setForm({...emptyForm});setError('');setNotice('');}}><Plus size={17}/> New Video</button></header>
    {error && <div role="alert" className="mb-5 rounded-lg border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}<div className="mt-2 flex flex-wrap gap-4"><a href="#video-files" className="underline">Review uploaded files</a><Link href="/app/compliance" className="underline">Documentation records</Link></div></div>}{notice && <p role="status" className="mb-5 text-sm text-emerald-300">{notice}</p>}
    {form && <form onSubmit={submit} onInvalidCapture={event => {
      const field = event.target;
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        field.closest('details')?.setAttribute('open', '');
        const label = field.closest('label')?.firstChild?.textContent?.trim() || 'Required field';
        setError(label + ': ' + field.validationMessage);

      }
    }} className="mb-8 rounded-xl border border-white/10 bg-[#0f1522] p-5 sm:p-7"><div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-medium">{form.id ? 'Edit Video' : 'New Video'}</h2><button type="button" aria-label="Close product editor" disabled={locked} className={buttonClass} onClick={() => setForm(null)}><X size={17}/></button></div><fieldset disabled={locked} className="grid min-w-0 gap-5 sm:grid-cols-2">
<h3 id="video-files" className="text-sm font-medium sm:col-span-2">Upload</h3>
      {form.thumbnailMediaAssetId && <img src={`/api/media/${form.thumbnailMediaAssetId}/thumbnail-source`} alt="Selected video cover" className="max-h-48 max-w-full rounded-lg object-contain sm:col-span-2"/>}
      <ProductUpload label="Full Video" accept="video/mp4,video/quicktime,video/x-m4v" fileName={media.find(item => item.id === form.mediaAssetId)?.originalFileName} disabled={locked} progress={uploadingField === 'mediaAssetId' ? activeUpload?.progress ?? 0 : undefined} onFile={file => void upload('mediaAssetId',file)}/>
      <ProductUpload label="Teaser" accept="video/mp4,video/quicktime,video/x-m4v" fileName={media.find(item => item.id === form.teaserMediaAssetId)?.originalFileName} disabled={locked} progress={uploadingField === 'teaserMediaAssetId' ? activeUpload?.progress ?? 0 : undefined} onFile={file => void upload('teaserMediaAssetId',file)} help="The teaser will be publicly playable in full."/>
      <ProductUpload label="Cover Image" accept="image/jpeg,image/png,image/webp" fileName={media.find(item => item.id === form.thumbnailMediaAssetId)?.originalFileName} disabled={locked} progress={uploadingField === 'thumbnailMediaAssetId' ? activeUpload?.progress ?? 0 : undefined} onFile={file => void upload('thumbnailMediaAssetId',file)} help="A cover is required before publication."/>
<h3 className="text-sm font-medium sm:col-span-2">Information</h3>


      <label className="grid min-w-0 gap-2 text-xs text-white/70">Title<input className={fieldClass} required maxLength={160} value={form.title} onChange={event => updateTitle(event.target.value)}/></label>
      <label className="grid min-w-0 gap-2 text-xs text-white/70 sm:col-span-2">Description<textarea aria-label="Description" className={fieldClass} rows={4} maxLength={5000} value={form.description} onChange={event => update('description',event.target.value)}/></label>

      <label className="grid min-w-0 gap-2 text-xs text-white/70">Price (USD)<input className={fieldClass} inputMode="decimal" placeholder="19.99" required value={form.price} onChange={event => update('price',event.target.value)}/></label>


      <div className="flex flex-wrap gap-3 sm:col-span-2"><button className={`${buttonClass} text-emerald-300`} type="submit" value="PUBLISHED" disabled={!form.mediaAssetId || !form.teaserMediaAssetId || !form.thumbnailMediaAssetId}>{busy ? 'Checking...' : 'Publish for Sale'}</button><button type="button" className={buttonClass} onClick={() => setForm(null)}>Cancel</button></div>
      </fieldset></form>}

    <label className="mb-4 flex items-center gap-3 text-sm">Show videos<select aria-label="Show videos" className="rounded-lg border border-white/15 bg-[#111827] px-3 py-2" value={listFilter} onChange={event => setListFilter(event.target.value)}><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option><option value="ALL">All</option></select></label>
    {!visibleProducts.length ? <div className="rounded-xl border border-white/10 p-10 text-center"><h2 className="text-lg">No videos in this view.</h2><p className="mt-2 text-sm text-white/45">Choose another filter or create a product to prepare it for sale.</p></div> : <div className="grid gap-4">{visibleProducts.map(product => <article key={product.id} className="flex min-w-0 flex-wrap gap-5 rounded-xl border border-white/10 bg-[#101623] p-5"><img src={`/api/store/products/${product.id}/thumbnail?v=${encodeURIComponent(product.updatedAt)}`} alt={`Cover for ${product.title}`} className="h-24 w-36 rounded-lg object-cover"/><div className="min-w-0 flex-1 basis-52"><div className="flex flex-wrap items-center gap-3"><h2 className="break-words text-lg font-medium">{product.title}</h2><span className="rounded bg-white/5 px-2 py-1 text-[10px]">{product.status}</span>{product.complianceStatus && <span className="rounded bg-violet-500/10 px-2 py-1 text-[10px]">Review: {product.complianceStatus.replaceAll('_', ' ')}</span>}{product.featured && <span className="text-xs text-violet-300">Featured</span>}</div><p className="mt-2 text-sm text-violet-200">{priceLabel(product.priceCents,product.currency)} · {product.category}</p><p className="mt-2 break-all text-xs text-white/40">Video: {media.find(item => item.id === product.mediaAssetId)?.originalFileName ?? 'Unavailable'}<br/>Teaser: {product.teaserMediaAssetId ? media.find(item => item.id === product.teaserMediaAssetId)?.originalFileName ?? 'Unavailable' : 'None'}</p><p className="mt-2 text-xs text-white/40">/{product.slug}{product.publishedAt && new Date(product.publishedAt).getTime() > Date.now() ? ' · Scheduled' : ''}</p></div><div className="flex flex-wrap items-center gap-2"><button className={buttonClass} disabled={locked} onClick={() => edit(product)}><Pencil size={15}/> Edit</button>{canDelete && product.status !== 'ARCHIVED' && <button type="button" className={buttonClass + ' cursor-pointer border-rose-400/20 text-rose-300 hover:bg-rose-400/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-300'} disabled={locked} aria-label={'Remove from Sale: ' + product.title} onClick={() => { setError(''); setNotice(''); setDeleteTarget(product); }}><Trash2 size={15} aria-hidden="true"/> Remove from Sale</button>}{canDelete && <PermanentlyDeleteVideo product={product} disabled={locked} onDeleted={id => { setProducts(current => current.filter(item => item.id !== id)); if (form?.id === id) setForm(null); setError(''); setNotice('Video product permanently deleted. Media Library and R2 media preserved.'); }}/>}<WatchFullVideo video={product} className={buttonClass} label="Watch Video"/>{product.status !== 'PUBLISHED' && <button className={`${buttonClass} text-emerald-300`} disabled={locked} onClick={() => void save({...productPayload(product),status:'PUBLISHED'},product.id)}><Check size={15}/> Publish</button>}{!canDelete && product.status !== 'ARCHIVED' && <button className={`${buttonClass} text-white/55`} disabled={locked} onClick={() => void save({...productPayload(product),status:'ARCHIVED'},product.id)}><Archive size={15}/> Archive</button>}{product.status === 'PUBLISHED' && <button type="button" className={buttonClass} disabled={locked} onClick={() => void save({...productPayload(product),status:'DRAFT'},product.id)}>Unpublish</button>}{product.status === 'PUBLISHED' && <Link className={buttonClass} href={`/videos/${product.slug}`}>View</Link>}</div></article>)}</div>}
    {deleteTarget && <DeleteVideoDialog product={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={archived => { setProducts(current => current.map(product => product.id === archived.id ? archived : product)); if (form?.id === archived.id) setForm(null); setDeleteTarget(null); setError(''); setNotice('Video removed from the storefront. Purchase history and media preserved.'); }}/>}
  </div>;
}
