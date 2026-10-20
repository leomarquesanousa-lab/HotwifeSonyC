'use client';
import type { FormEvent } from 'react';
import Link from 'next/link';
import type { ComplianceDashboard } from '@/src/lib/compliance/service';
type Video = ComplianceDashboard['videoApprovals'][number];
const field = 'rounded-lg border border-white/20 bg-[#111827] p-3 text-sm';
const button = 'min-h-11 rounded-lg bg-violet-500/20 px-5 py-3 disabled:opacity-50';
export default function VideoApprovalCard({ video, busy, onSubmit }: { video: Video; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>, action: string) => Promise<void> }) {
  const options = (selected: string | null) => <><option value="">Reuse applicable evidence already associated</option>{selected && !video.documents.some(document => document.id === selected) && <option value={'document:' + selected}>Previously associated document is unavailable</option>}{video.documents.map(document => <option key={document.id} value={'document:' + document.id}>{document.title}</option>)}</>;
  return <article className="grid gap-4 rounded-xl border border-white/10 bg-[#101623] p-5" aria-label={'Video approval: ' + video.title}>
    <header><h3 className="text-xl font-semibold">{video.title}</h3><p>{video.creatorName} · <strong>{video.status}</strong></p></header>
    <div className="text-sm text-white/70"><p>Recording date: {video.recordedOn ?? 'Not recorded'}</p><p>Consent for this video: {video.consentAvailable ? 'Associated evidence available' : 'Action required'}</p><p>Distribution rights: {video.rightsAvailable ? 'Associated evidence available' : 'Action required'}</p><p>Last content review: {video.reviewedAt ? new Date(video.reviewedAt).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'Not recorded'}</p><p>Protected documents available: {video.documents.length}</p></div>
    {video.missing.length > 0 && <ul className="list-inside list-disc text-sm text-amber-200">{video.missing.map(item => <li key={item}>{item}</li>)}</ul>}
    <form className="grid gap-4" onSubmit={event => {
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      void onSubmit(event, submitter instanceof HTMLButtonElement && submitter.value === 'creatorEvidence' ? 'creatorEvidence' : 'creatorReview');
    }}>
      <input type="hidden" name="productId" value={video.id}/>
      <label className="grid gap-2">Recording date<input aria-label="Recording date" name="recordedOn" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={video.recordedOn ?? ''} className={field}/><span className="text-xs text-white/50">The actual filming date, saved once for this video. This is not the publication date.</span></label>
      <label className="grid gap-2">Signed consent covering this video<select aria-label="Signed consent covering this video" name="consentEvidenceRef" defaultValue={video.consentDocumentId ? 'document:' + video.consentDocumentId : ''} className={field}>{options(video.consentDocumentId)}</select></label>
      <label className="grid gap-2">Distribution rights covering this video<select aria-label="Distribution rights covering this video" name="rightsEvidenceRef" defaultValue={video.rightsDocumentId ? 'document:' + video.rightsDocumentId : ''} className={field}>{options(video.rightsDocumentId)}</select></label>
      <p className="text-xs text-white/60">Choose existing documents only after checking that they cover this video, its previews and streaming rights. A document on file is not automatically an authorization.</p>
      <label className="text-sm"><input type="checkbox" name="reviewed"/> I reviewed the full video, teaser, cover and supporting documents. Only the linked adult creator appears, consent covers this content, and the distribution rights and safety requirements are satisfied.</label>
      <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} type="submit" value="creatorEvidence">Save Evidence</button><button className={button} disabled={busy} type="submit" value="creatorReview">Approve Video</button><Link href="/app/store/videos" className="self-center text-violet-200 underline">Open Videos for Sale to Publish</Link></div>
      <p className="text-xs text-white/50">Save Evidence preserves your progress without approval. Approve Video requires a real content review.</p>
    </form>
  </article>;
}
