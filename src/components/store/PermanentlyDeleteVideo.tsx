'use client';
import { useEffect, useRef, useState, useId } from 'react';
import type { StoreProduct } from '@/src/lib/store/types';

export default function PermanentlyDeleteVideo({ product, disabled, onDeleted }: { product: StoreProduct; disabled: boolean; onDeleted: (id: string) => void }) {
  const [eligible, setEligible] = useState(false);
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/store/products/${encodeURIComponent(product.id)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { const data = await response.json(); if (response.ok && !controller.signal.aborted) { setEligible(data.permanentDeletionAllowed === true); setReason(typeof data.permanentDeletionReason === 'string' ? data.permanentDeletionReason : ''); } })
      .catch(() => {});
    return () => controller.abort();
  }, [product.id, product.updatedAt]);
  return <>{reason && <p className="max-w-xs text-xs text-white/55">{reason}</p>}{eligible && <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="min-h-11 cursor-pointer rounded-lg border border-rose-400/20 px-4 py-2 text-sm text-rose-300 hover:bg-rose-400/10 focus-visible:outline-2 focus-visible:outline-rose-300 disabled:opacity-50">Delete Permanently</button>}{open && <PermanentDeleteDialog product={product} onClose={() => setOpen(false)} onDeleted={onDeleted}/>}</>;
}

function PermanentDeleteDialog({ product, onClose, onDeleted }: { product: StoreProduct; onClose: () => void; onDeleted: (id: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; trigger?.focus(); };
  }, []);
  async function confirm() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/store/products/${encodeURIComponent(product.id)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true, action: 'permanent' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to permanently delete this video. Please try again.');
      onDeleted(data.deletedId);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to permanently delete this video. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); if (!submitting.current) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-auto rounded-2xl border border-white/15 bg-[#101623] p-6 text-white shadow-2xl backdrop:bg-black/80 sm:p-8">
    <h2 id={titleId} className="text-xl font-semibold">Delete permanently?</h2>
    <div id={descriptionId} className="mt-3 space-y-3 text-sm leading-6 text-white/70"><p>This will permanently delete this video product from Videos for Sale. This action cannot be undone.</p><p className="break-words text-white">{product.title}</p><p>Media Library files and R2 media will not be deleted.</p></div>
    {error && <p role="alert" className="mt-4 text-sm text-rose-200">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" autoFocus disabled={busy} onClick={onClose} className="min-h-11 cursor-pointer rounded-lg border border-white/20 px-5 py-2 text-sm focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50">Cancel</button><button type="button" disabled={busy} onClick={() => void confirm()} className="min-h-11 cursor-pointer rounded-lg bg-rose-600 px-5 py-2 text-sm focus-visible:outline-2 focus-visible:outline-rose-300 disabled:opacity-50">{busy ? 'Deleting...' : 'Delete Permanently'}</button></div>
  </dialog>;
}
