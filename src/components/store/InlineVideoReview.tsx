'use client';
import { useEffect, useState, type FormEvent } from 'react';
import VideoApprovalCard from '@/components/compliance/VideoApprovalCard';
import type { ComplianceDashboard } from '@/src/lib/compliance/service';

export default function InlineVideoReview({ productId, onApproved, onBusyChange }: { productId: string; onApproved: () => Promise<unknown>; onBusyChange: (busy: boolean) => void }) {
  const [video, setVideo] = useState<ComplianceDashboard['videoApprovals'][number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/compliance', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load the required video review.');
      if (!controller.signal.aborted) setVideo(data.videoApprovals.find((item: { id: string }) => item.id === productId) ?? null);
    }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load the required video review.'); });
    return () => controller.abort();
  }, [productId, attempt]);
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    const value: Record<string, unknown> = { action };
    for (const [key, item] of form.entries()) if (item !== '') value[key] = item;
    if (form.has('reviewed')) value.reviewed = form.get('reviewed') === 'on';
    setBusy(true); onBusyChange(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/compliance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw new Error(data.error || 'The server did not confirm the review.');
      if (action === 'creatorReview') { setNotice('Review approved. Publishing the saved video...'); const published = await onApproved(); if (!published) setNotice('Review saved; publication was not confirmed. Check the error above and retry Publish.'); }
      else { setNotice('Evidence saved. Confirm the content review below to publish.'); setAttempt(current => current + 1); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to confirm the video review.'); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <section className="mb-8 grid gap-3" aria-label="Review and publish here"><h2 className="text-lg font-medium">Review and publish here</h2><p className="text-xs text-white/60">This review covers the saved draft. Save any changes to files or participants before reviewing. Additional people require their own verified identity and consent in Safety &amp; Compliance.</p>{error && <div role="alert">{error}<button type="button" disabled={busy} onClick={() => { setError(''); setAttempt(current => current + 1); }} className="ml-2 min-h-11 underline">Retry review check</button></div>}{notice && <p role="status">{notice}</p>}{video && <VideoApprovalCard video={video} busy={busy} onSubmit={submit} approveLabel="Approve and Publish"/>}</section>;
}
