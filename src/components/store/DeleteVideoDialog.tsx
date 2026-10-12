'use client';
import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { StoreProduct } from '@/src/lib/store/types';

export default function DeleteVideoDialog({ product, onClose, onDeleted }: { product: StoreProduct; onClose: () => void; onDeleted: (product: StoreProduct) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paidPurchaseCount, setPaidPurchaseCount] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewAttempt, setPreviewAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/store/products/${encodeURIComponent(product.id)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !Number.isSafeInteger(data.paidPurchaseCount) || data.paidPurchaseCount < 0) throw new Error('Unable to check purchases. Please try again.');
        if (!controller.signal.aborted) setPaidPurchaseCount(data.paidPurchaseCount);
      }).catch(() => { if (!controller.signal.aborted) setPreviewError('Unable to check purchases. Please try again.'); });
    return () => controller.abort();
  }, [product.id, previewAttempt]);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; trigger?.focus(); };
  }, []);
  async function confirm() {
    if (submitting.current || paidPurchaseCount === null) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/store/products/${encodeURIComponent(product.id)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to delete this video. Please try again.');
      onDeleted(data.product);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to delete this video. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} aria-modal="true" aria-labelledby="delete-video-title" aria-describedby="delete-video-description" onCancel={event => { event.preventDefault(); if (!submitting.current) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-auto rounded-2xl border border-white/15 bg-[#101623] p-6 text-white shadow-2xl backdrop:bg-black/80 sm:p-8">
    <Trash2 size={24} className="mb-4 text-rose-300" aria-hidden="true"/>
    <h2 id="delete-video-title" className="text-xl font-semibold">Remove video from sale?</h2>
    <div id="delete-video-description" className="mt-3 space-y-3 text-sm leading-6 text-white/70"><p>This will remove <strong className="break-words text-white">{product.title}</strong> from the storefront by archiving the product.</p><p>The administrative record, purchase history and existing purchased access are preserved. Media Library files and R2 media will not be deleted.</p></div>
    {paidPurchaseCount === null && !previewError && <p role="status" className="mt-4 text-sm text-white/70">Checking purchases...</p>}
    {previewError && <div role="alert" className="mt-4 text-sm text-rose-200">{previewError}<button type="button" className="ml-2 cursor-pointer underline" onClick={() => { setPreviewError(''); setPreviewAttempt(value => value + 1); }}>Retry</button></div>}
    {paidPurchaseCount !== null && <div className="mt-4 space-y-3 text-sm leading-6 text-white/80">{paidPurchaseCount > 0 && <p role="status">This video has already been purchased by {paidPurchaseCount} {paidPurchaseCount === 1 ? 'user' : 'users'}. Removing it from sale will not remove it from their libraries. Existing customers will keep access to the video.</p>}<p>Do you want to remove this video from sale?</p></div>}
    {error && <p role="alert" className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" autoFocus disabled={busy} onClick={onClose} className="min-h-11 cursor-pointer rounded-lg border border-white/20 px-5 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50">Cancel</button><button type="button" disabled={busy || paidPurchaseCount === null} onClick={() => void confirm()} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={15} aria-hidden="true"/>{busy ? 'Removing...' : 'Remove from Sale'}</button></div>
  </dialog>;
}
