'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import ComplianceAdmin from './ComplianceAdmin';
import type { ComplianceDashboard } from '@/src/lib/compliance/service';

const field = 'rounded-lg border border-white/20 bg-[#111827] p-3 text-sm';
const panel = 'grid gap-4 rounded-xl border border-white/10 bg-[#101623] p-5';
const button = 'min-h-11 rounded-lg bg-violet-500/20 px-5 py-3 disabled:opacity-50';
type Document = { id: string; title: string; documentType: string; status: string };
export default function CreatorVerification({ initial }: { initial: ComplianceDashboard }) {
  const [data, setData] = useState(initial);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const creator = data.creator;
  const personId = creator.performerId;
  const [productId, setProductId] = useState(data.products[0]?.id ?? '');
  const review = data.reviews.find(item => item.videoProductId === productId);
  const loadDocuments = useCallback(async () => {
    if (!personId) { setDocuments([]); return; }
    const response = await fetch(`/api/performers/${personId}/documents`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || 'Unable to load protected documents.');
    setDocuments((result.documents ?? []).filter((item: Document) => item.status === 'ACTIVE'));
  }, [personId]);
  useEffect(() => { void loadDocuments().catch(error => setError(error.message)); }, [loadDocuments]);
  async function refresh() {
    const response = await fetch('/api/admin/compliance', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to refresh verification.');
    setData(result);
  }
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const value: Record<string, unknown> = { action };
    for (const [key, item] of form.entries()) if (item !== '') value[key] = item;
    for (const key of ['samePerson', 'reviewed']) if (form.has(key)) value[key] = form.get(key) === 'on';
    if (action === 'creatorIdentity') value.expiresAt = form.get('expiresAt') ? `${form.get('expiresAt')}T23:59:59.000Z` : null;
    try {
      const response = await fetch('/api/admin/compliance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to record the review.');
      await refresh(); setMessage(action === 'creatorLink' ? 'Creator profile linked. The status shows whether valid identity evidence was reused or a review is needed.' : 'Review recorded. Valid records will be reused.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to record the review.'); }
    finally { setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!personId) return;
    const form = event.currentTarget; const body = new FormData(form);
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/performers/${personId}/documents`, { method: 'POST', body });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to upload the document.');
      await loadDocuments(); form.reset(); setMessage('Protected document saved. Uploading does not verify identity or approve a video.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Upload failed.'); }
    finally { setBusy(false); }
  }
  const documentOptions = <><option value="">Select a protected document</option>{documents.map(document => <option key={document.id} value={'document:' + document.id}>{document.title}</option>)}</>;
  return <main className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8" lang="en-US">
    <header><h1 className="text-3xl font-semibold">Creator Verification</h1><p className="mt-3 text-white/60">One creator, one identity review. Keep evidence here and publish products from Videos for Sale.</p></header>
    <section className={panel} aria-label="Creator status"><strong className="text-xl">{creator.status}</strong>{creator.missing.map((item, index) => <p key={index}>{item}</p>)}<p className="text-sm text-white/60">This status covers the creator's identity. Each video also needs applicable consent and distribution rights.</p><button className={button} disabled={busy} onClick={() => { void refresh().catch(error => setError(error.message)); }}>Refresh status</button></section>
    {error && <p role="alert" className="text-amber-200">{error}</p>}{message && <p role="status" className="text-emerald-300">{message}</p>}
    {!personId && <form className={panel} onSubmit={event => void submit(event, 'creatorLink')}><h2 className="text-xl">Link the owner to the creator</h2><p>The OWNER account is selected securely by the server. Linking never replaces an actual identity review. Existing valid evidence may be reused.</p>{data.performers.length > 0 ? <label className="grid gap-2">Creator profile<select aria-label="Creator profile" name="performerId" className={field} required><option value="">Select the owner's profile</option>{data.performers.map(person => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label> : <label className="grid gap-2">Creator name<input name="displayName" className={field} required maxLength={120}/></label>}<label><input type="checkbox" name="samePerson" required/> I checked the actual identity evidence and confirmed that the OWNER account and this creator profile belong to the same person.</label><button disabled={busy} className={button}>Link creator profile</button></form>}
    {personId && <>
      <section className={panel}><h2 className="text-xl">Protected documents</h2><p>Upload government-issued identity evidence, signed consent or distribution-rights documents. PDF, JPG, PNG or TXT, up to 5 MB. No public document links are created.</p><form className="grid gap-3" onSubmit={event => void upload(event)}><label className="grid gap-2">Document title<input name="title" className={field} required maxLength={200}/></label><label className="grid gap-2">Document purpose<select aria-label="Document purpose" name="documentType" className={field}><option value="PHOTO_ID">Identity evidence</option><option value="RELEASE_FORM">Signed consent</option><option value="OTHER">Distribution rights or other evidence</option></select></label><input aria-label="Protected document file" type="file" name="file" accept="application/pdf,image/jpeg,image/png,text/plain" required/><button disabled={busy} className={button}>Save protected document</button></form><ul>{documents.map(document => <li key={document.id}><button className="min-h-11 text-violet-200 underline" onClick={() => { void (async () => { const response = await fetch(`/api/performers/${personId}/documents/${document.id}`, { cache: 'no-store' }); const result = await response.json(); if (!response.ok || !result.url) throw new Error('Unable to open this protected document.'); window.open(result.url, '_blank', 'noopener,noreferrer'); })().catch(error => setError(error.message)); }}>View {document.title}</button></li>)}</ul></section>
      {creator.status !== 'Verified' ? <form id="creator-identity" className={panel} onSubmit={event => void submit(event, 'creatorIdentity')}><h2 className="text-xl">Review creator identity</h2><label className="grid gap-2">Date of birth<input name="dateOfBirth" type="date" required className={field}/></label><label className="grid gap-2">Identity evidence<select aria-label="Identity evidence" name="evidenceRef" required className={field}>{documentOptions}</select></label><label className="grid gap-2">Evidence expires on (if applicable)<input name="expiresAt" type="date" className={field}/></label><input type="hidden" name="samePerson" value="on"/><label><input type="checkbox" name="reviewed" required/> I inspected the actual identity evidence, matched it to the owner and creator, and confirmed adult age and document validity.</label><button disabled={busy} className={button}>Record identity review</button></form> : <p className="rounded-xl border border-emerald-400/20 p-5">Identity verified. No new identity form is needed for each video.</p>}
      <form key={productId + (review?.reviewedAt ?? '')} className={panel} onSubmit={event => void submit(event, 'creatorReview')}><h2 className="text-xl">Review a video</h2><p>Save the product as Draft first. Reuse valid records for the same media; different content needs its own applicable evidence.</p><label className="grid gap-2">Video<select aria-label="Video" name="productId" value={productId} onChange={event => setProductId(event.target.value)} required className={field}><option value="">Select a video</option>{data.products.map(product => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label><label className="grid gap-2">Recording date<input name="recordedOn" type="date" defaultValue={review?.recordedOn ?? ''} required className={field}/></label><label className="grid gap-2">Signed consent covering this video<select aria-label="Signed consent covering this video" name="consentEvidenceRef" className={field}><option value="">Reuse valid consent already on file</option>{documents.map(document => <option key={document.id} value={'document:' + document.id}>{document.title}</option>)}</select></label><label className="grid gap-2">Distribution rights covering this video<select aria-label="Distribution rights covering this video" name="rightsEvidenceRef" className={field}><option value="">Reuse rights from the existing approved review</option>{documents.map(document => <option key={document.id} value={'document:' + document.id}>{document.title}</option>)}</select></label><label><input type="checkbox" name="reviewed" required/> I reviewed the full video, teaser and cover. Only the linked adult creator appears. The selected or existing documents authorize depiction, publication, streaming and distribution; the content complies with safety rules.</label><button className={button} disabled={busy || creator.status !== 'Verified'}>Record video review</button><Link href="/app/store/videos" className="text-violet-200 underline">Return to Videos for Sale to Publish</Link></form>
    </>}
    <details className="rounded-xl border border-white/10 p-5"><summary className="cursor-pointer">Additional people and safety administration</summary><p className="my-4">Use this only for content featuring other people, reports, restrictions or exceptional record changes.</p><ComplianceAdmin key={data.asOf} initial={data}/></details>
  </main>;
}
