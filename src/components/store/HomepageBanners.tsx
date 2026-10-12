'use client';
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import type { HomepageBanner } from '@/src/lib/homepage-banners/types';
const button = 'min-h-11 cursor-pointer rounded-lg border border-white/20 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50';
const input = 'w-full rounded-lg border border-white/20 bg-[#111827] px-3 py-2';
function Modal({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    const element = ref.current;
    document.body.style.overflow = 'hidden'; element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; trigger?.focus(); };
  }, []);
  return <dialog ref={ref} aria-modal="true" aria-labelledby="banner-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-2xl border border-white/20 bg-[#101623] p-6 text-white backdrop:bg-black/80"><h2 id="banner-dialog-title" className="mb-5 text-xl font-semibold">{title}</h2>{children}</dialog>;
}
export default function HomepageBanners({ initialBanners }: { initialBanners: HomepageBanner[] }) {
  const [banners, setBanners] = useState(initialBanners);
  const [editor, setEditor] = useState<HomepageBanner | 'new' | null>(null);
  const [deleting, setDeleting] = useState<HomepageBanner | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function send(method: string, body: string) {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/homepage-banners', { method, body, headers: { 'Content-Type': 'application/json' } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save banners. Please try again.');
      setBanners(data.banners); setEditor(null); setDeleting(null); setNotice(method === 'DELETE' ? 'Banner deleted from the homepage carousel.' : 'Banner saved. The homepage uses the updated configuration.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save banners. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set('active', data.get('active') === 'on' ? 'true' : 'false');
    if (editor && editor !== 'new') data.set('id',editor.id);
    const payload: Record<string, unknown> = Object.fromEntries(data);
    const image = data.get('image');
    delete payload.image;
    if (image instanceof File && image.size) {
      if (image.size > 5 * 1024 * 1024) { setError('Image must be 5 MB or smaller.'); return; }
      const encoded = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(image); });
      payload.image = { type: image.type, data: encoded };
    }
    void send('POST', JSON.stringify(payload));
  }
  const editing = editor && editor !== 'new' ? editor : null;
  function close() { setEditor(null); setDeleting(null); setError(''); }
  return <main className="mx-auto max-w-5xl p-5 sm:p-8">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold">Homepage Banners</h1><button className={button + ' bg-violet-500/20'} disabled={busy || banners.length >= 10} onClick={() => { setError(''); setNotice(''); setEditor('new'); }}>Add Banner</button></header>
    {banners.length >= 10 && <p className="mb-4 text-sm text-white/60">Maximum of 10 banners reached.</p>}
    {notice && <p role="status" className="mb-4 text-sm text-emerald-300">{notice}</p>}
    {!banners.length && <p className="text-white/60">No banners. Add a banner to show it on the homepage.</p>}
    <div className="grid gap-4">{[...banners].sort((a,b) => a.order - b.order).map(banner => <article key={banner.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 p-4">
      {/* Administrative thumbnails retain the full photo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={banner.src} alt={banner.alt} width={160} height={90} className="h-24 w-40 rounded-lg bg-black object-contain"/>
      <div className="flex-1 text-sm"><p>{banner.active ? 'Active' : 'Inactive'}</p><p className="mt-1 text-white/50">Order: {banner.order}</p></div>
      <button className={button} disabled={busy} aria-label={`Edit banner ${banner.order}`} onClick={() => { setError(''); setNotice(''); setEditor(banner); }}>Edit</button>
      <button className={button + ' text-rose-300'} disabled={busy} aria-label={`Delete banner ${banner.order}`} onClick={() => { setError(''); setNotice(''); setDeleting(banner); }}>Delete</button>
    </article>)}</div>
    {editor && <Modal title={editing ? 'Edit Banner' : 'Add Banner'} busy={busy} onClose={close}><form onSubmit={save}><fieldset disabled={busy} className="grid gap-4 text-sm">
      <label>Image<input autoFocus className={input + ' mt-2'} name="image" type="file" accept="image/png,image/jpeg,image/webp" required={!editing}/><span className="mt-1 block text-xs text-white/50">PNG, JPEG or WebP · up to 5 MB{editing ? '. Leave empty to keep the current image.' : ''}</span></label>
      <label className="flex items-center gap-2"><input name="active" type="checkbox" defaultChecked={editing?.active ?? true}/>Active</label>
      <label>Order<input className={input} name="order" type="number" min={1} max={Math.min(10,banners.length + (editing ? 0 : 1))} required defaultValue={editing?.order ?? banners.length + 1}/></label>
      <p className="text-white/60">Focal point: 0 = left/top, 100 = right/bottom.</p>
      <div className="grid grid-cols-2 gap-3">{[{ name:'focalX',label:'Desktop X',value:editing?.focal.x },{ name:'focalY',label:'Desktop Y',value:editing?.focal.y },{ name:'mobileX',label:'Mobile X',value:editing?.mobileFocal.x },{ name:'mobileY',label:'Mobile Y',value:editing?.mobileFocal.y }].map(field => <label key={field.name}>{field.label}<input className={input} name={field.name} type="number" min={0} max={100} step="any" required defaultValue={field.value ?? 50}/></label>)}</div>
      {error && <p role="alert" className="text-rose-300">{error}</p>}
      <div className="mt-2 flex justify-end gap-3"><button className={button} type="button" onClick={close}>Cancel</button><button className={button + ' bg-violet-500/20'} type="submit">{busy ? 'Saving...' : 'Save'}</button></div>
    </fieldset></form></Modal>}
    {deleting && <Modal title="Delete banner?" busy={busy} onClose={close}><p>This banner will be removed from the homepage carousel.</p><p className="mt-3 text-sm text-white/50">The image file will be preserved.</p>{error && <p role="alert" className="mt-3 text-rose-300">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button autoFocus className={button} disabled={busy} onClick={close}>Cancel</button><button className={button + ' bg-rose-600'} disabled={busy} onClick={() => void send('DELETE',JSON.stringify({ id: deleting.id, confirmed: true }))}>{busy ? 'Deleting...' : 'Delete'}</button></div></Modal>}
  </main>;
}
