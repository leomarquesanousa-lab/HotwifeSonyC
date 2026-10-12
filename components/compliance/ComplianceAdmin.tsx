'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import type { ComplianceDashboard } from '@/src/lib/compliance/service';
import { reportStatuses, reviewStatuses } from '@/src/lib/compliance/constants';

const field = 'w-full min-w-0 rounded-lg border border-white/20 bg-[#111827] p-3 text-sm text-white';
const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-violet-300/30 bg-violet-500/15 px-4 py-2 text-sm text-violet-100 disabled:opacity-50';
const panel = 'rounded-xl border border-white/10 bg-[#101623] p-5';
function Select({ name, title, children, value }: { name: string; title: string; children: ReactNode; value?: string }) { return <label className="grid gap-2 text-sm">{title}<select name={name} className={field} defaultValue={value} required>{children}</select></label>; }
function Check({ name, children }: { name: string; children: ReactNode }) { return <label className="flex items-start gap-3 text-sm text-white/70"><input name={name} type="checkbox" required={name === 'attest'}/>{children}</label>; }
function Note() { return <label className="grid gap-2 text-sm">Internal note / decision<textarea name="note" className={field} required minLength={5} maxLength={3000} rows={3}/></label>; }
export default function ComplianceAdmin({ initial }: { initial: ComplianceDashboard }) {
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState('Reports');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function refresh(filter = status) {
    const response = await fetch(`/api/admin/compliance${filter ? '?status=' + encodeURIComponent(filter) : ''}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to load compliance records.');
    setData(result);
  }
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const value: Record<string, unknown> = { action };
    for (const [key, item] of form.entries()) if (item !== '') value[key] = item;
    if (action === 'identity') { value.attest = form.get('attest') === 'on'; value.expiresAt = form.get('expiresAt') ? `${form.get('expiresAt')}T23:59:59.000Z` : null; }
    if (action === 'consent') { for (const key of ['attest', 'depiction', 'distribution', 'publication']) value[key] = form.get(key) === 'on'; value.downloads = false; }
    if (action === 'review') for (const key of ['allPersonsConfirmed', 'prohibitedChecked', 'copyrightConfirmed']) value[key] = form.get(key) === 'on';
    try {
      const response = await fetch('/api/admin/compliance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Action was not recorded.');
      await refresh(); setMessage('Decision recorded with an audit event.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Action failed.'); }
    finally { setBusy(false); }
  }
  const productOptions = <><option value="">Select content</option>{data.products.map(p => <option value={p.id} key={p.id}>{p.title} / {p.complianceStatus}</option>)}</>;
  const personOptions = <><option value="">Select person</option>{data.performers.map(p => <option value={p.id} key={p.id}>{p.displayName}</option>)}</>;
  const memberOptions = <><option value="">Select provider</option>{data.members.map(m => <option value={m.userId} key={m.userId}>{m.userId} ({m.role})</option>)}</>;
  const submitButton = <button className={button} disabled={busy}>Record action</button>;
  return <main className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8" lang="en">
    <header><p className="text-xs uppercase tracking-widest text-violet-300">Safety administration</p><h1 className="mt-2 text-3xl font-semibold">Compliance / Reports</h1><p className="mt-3 text-sm leading-6 text-white/50">OWNER / ADMIN only. Inspect actual evidence before verification or approval. Do not paste raw IDs, signed storage URLs or card information into notes.</p></header>
    <aside className={panel}><h2 className="text-lg">Launch readiness</h2><p className="mt-2 text-sm text-amber-200">Pending legal configuration: {data.pending.length ? data.pending.join(', ') : 'none'}.</p><p className="mt-2 text-xs text-white/50">External ID verification, viewer age-assurance requirements and legal/processor review remain separate obligations. Existing LEGACY_UNREVIEWED products have not been approved. Review the full catalog before underwriting. This screen records human decisions; it does not authenticate documents. No processor approval is guaranteed.</p></aside>
    <nav className="flex flex-wrap gap-2" aria-label="Compliance sections">{['Reports', 'Publication review', 'Age & identity', 'Consent', 'Audit log'].map(item => <button type="button" key={item} className={button} aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {error && <p role="alert" className="text-red-300">{error}</p>}{message && <p role="status" className="text-emerald-300">{message}</p>}
    {tab === 'Reports' && <section className="space-y-4">
      <label className="grid max-w-xs gap-2">Filter status<select className={field} value={status} disabled={busy} onChange={event => { const next = event.target.value; setStatus(next); setError(''); void refresh(next).catch(e => setError(e.message)); }}><option value="">All statuses</option>{reportStatuses.map(s => <option key={s}>{s}</option>)}</select></label>
      <p className="text-xs text-white/50">Latest 200 matching reports. Five-business-day targets count weekdays in UTC; assess local holidays and mandatory deadlines separately.</p>
      {!data.reports.length && <p className="text-white/50">No matching complaints.</p>}
      {[...data.reports].sort((a,b) => Number(b.priority === 'HIGH') - Number(a.priority === 'HIGH') || a.dueAt.localeCompare(b.dueAt)).map(report => <details key={report.id} className={panel}><summary className="cursor-pointer text-sm"><strong>{report.priority === 'HIGH' ? 'HIGH PRIORITY / ' : ''}{report.kind}</strong> / {report.reason} / {report.status}<span className="ml-3 text-xs text-white/50">{report.id}</span>{new Date(report.dueAt).getTime() < new Date(data.asOf).getTime() && !['RESOLVED','REJECTED'].includes(report.status) && <span className="ml-3 text-red-300">OVERDUE</span>}</summary>
        <div className="mt-5 space-y-3 text-sm"><p className="break-all">Page: <a href={report.contentUrl} target="_blank" rel="noreferrer" className="text-violet-200 underline">{report.contentUrl}</a></p><p>{report.reporterName} / {report.reporterEmail} / Depicted: {report.depictedPerson ? 'Yes' : 'No'}</p><p className="whitespace-pre-wrap break-words text-white/75">{report.description}</p>{report.supportingInfo && <p className="whitespace-pre-wrap break-words text-white/55">Supporting information: {report.supportingInfo}</p>}<p className="text-xs text-white/50">Received {new Date(report.createdAt).toLocaleString('en-US')} / Target {new Date(report.dueAt).toLocaleString('en-US')}</p>
          <form className="grid gap-3" onSubmit={event => void submit(event,'report')}><input type="hidden" name="id" value={report.id}/><Select name="status" title="Status" value={report.status}>{reportStatuses.map(s => <option key={s}>{s}</option>)}</Select><label>Associated product (optional)<select name="productId" defaultValue={report.videoProductId || ''} className={field}>{productOptions}</select></label><Note/>{submitButton}</form>
          {data.notes.filter(n => n.objectType === 'COMPLIANCE_REPORT' && n.objectId === report.id).map(note => <p className="border-t border-white/10 pt-3 text-xs text-white/60" key={note.id}>{new Date(note.createdAt).toLocaleString('en-US')} / {note.actorId}<br/>{note.body}</p>)}
        </div></details>)}
    </section>}
    {tab === 'Age & identity' && <section className="grid gap-5 lg:grid-cols-2">
      <form className={panel + ' grid gap-4'} onSubmit={event => void submit(event,'identity')}><h2 className="text-lg">Record an actual identity review</h2>
        <Select name="subjectType" title="Subject type"><option value="USER">Content provider account</option><option value="PERFORMER">Depicted person</option></Select>
        <label>Subject ID<input name="subjectId" className={field} required placeholder="Copy the ID from the list alongside"/></label><label>Date of birth (protected)<input type="date" name="dateOfBirth" className={field} required/></label>
        <label>Protected evidence reference<input name="evidenceRef" className={field} required minLength={5} maxLength={300} placeholder="Protected vault, existing document or verification case reference"/></label><label>Document / verification expiry (if applicable)<input type="date" name="expiresAt" className={field}/></label>
        <Select name="status" title="Decision">{['NOT_VERIFIED','VERIFIED','REJECTED'].map(s=><option key={s}>{s}</option>)}</Select>
        <Check name="attest">I performed the review. For a verified result, I inspected government-issued age/identity evidence, matched the person to it and can retrieve the protected evidence.</Check>{submitButton}
      </form>
      <div className={panel}><h2 className="text-lg">Subjects and current status</h2><Link href="/app/performers" className="mt-3 inline-block text-sm text-violet-200 underline">Manage depicted-person profiles</Link>
        {[...data.members.map(m=>({type:'USER',id:m.userId,label:`Provider ${m.role}`})),...data.performers.map(p=>({type:'PERFORMER',id:p.id,label:p.displayName}))].map(subject => { const identity=data.identities.find(i=>i.subjectType===subject.type&&i.subjectId===subject.id);return <div key={subject.type+subject.id} className="mt-4 border-t border-white/10 pt-3 text-sm"><strong>{subject.label}</strong><p className="break-all text-xs text-white/50">{subject.type} / {subject.id}</p><p className="text-amber-200">{identity?.status || 'NOT_VERIFIED'}{identity?.expiresAt && new Date(identity.expiresAt).getTime() <= new Date(data.asOf).getTime() ? ' / EXPIRED' : ''}</p></div>;})}
      </div></section>}
    {tab === 'Consent' && <section className="grid gap-5 lg:grid-cols-2">
      <form className={panel + ' grid gap-4'} onSubmit={event => void submit(event,'consent')}><h2 className="text-lg">Record content-specific consent</h2><Select name="productId" title="Product">{productOptions}</Select><Select name="performerId" title="Depicted person">{personOptions}</Select><label>Protected signed release / agreement reference<input name="evidenceRef" className={field} required minLength={5} maxLength={300}/></label>
        <Check name="depiction">Consent to be depicted</Check><Check name="distribution">Consent to public distribution / streaming</Check><Check name="publication">Consent to upload / publication / applicable previews</Check>
        <p className="text-xs text-white/50">Downloads remain unavailable and are not authorized by this record.</p><Select name="status" title="Consent state">{['RECORDED','DISPUTED','REVOKED'].map(s=><option key={s}>{s}</option>)}</Select>
        <Check name="attest">I reviewed actual evidence and matched the person, content and permissions. Protected evidence is retrievable.</Check>{submitButton}
      </form><div className={panel}><h2 className="text-lg">Consent history</h2><p className="mt-2 text-xs text-white/50">Changing consent on a published product suspends it pending a new review.</p>{data.consents.map(record=><div key={record.id} className="mt-4 border-t border-white/10 pt-3 text-sm"><strong>{data.products.find(p=>p.id===record.videoProductId)?.title}</strong><p>{data.performers.find(p=>p.id===record.performerId)?.displayName} / {record.status}</p><p className="text-xs text-white/50">Depiction: {String(record.depiction)} / Distribution: {String(record.distribution)} / Publication: {String(record.publication)}<br/>{new Date(record.recordedAt).toLocaleString('en-US')}</p></div>)}</div>
    </section>}
    {tab === 'Publication review' && <section className="grid gap-5 lg:grid-cols-2">
      <form className={panel + ' grid gap-4'} onSubmit={event=>void submit(event,'review')}><h2 className="text-lg">Prepublication review</h2><Select name="productId" title="Product">{productOptions}</Select><Select name="providerUserId" title="Actual content provider">{memberOptions}</Select><label>Recording date<input type="date" name="recordedOn" className={field} required/></label>
        <Check name="allPersonsConfirmed">I inspected the full video, teaser and cover, identified every depicted person (including the creator), and checked their adult age at recording and consent.</Check><Check name="prohibitedChecked">I reviewed all content and metadata against prohibited-content rules.</Check><Check name="copyrightConfirmed">I checked copyright, distribution and personality/publicity rights.</Check>
        <Select name="status" title="Review state">{reviewStatuses.filter(s=>!['SUSPENDED','REMOVED'].includes(s)).map(s=><option key={s}>{s}</option>)}</Select><Note/><p className="text-xs text-white/50">Approval checks identity and content-specific consent. It does not publish: use Videos for Sale after approval.</p>{submitButton}
      </form><div className="space-y-5"><form className={panel + ' grid gap-4'} onSubmit={event=>void submit(event,'moderate')}><h2 className="text-lg">Immediate protective action</h2><Select name="productId" title="Product">{productOptions}</Select><Select name="status" title="Action"><option>SUSPENDED</option><option>REMOVED</option></Select><Note/>{submitButton}<p className="text-xs text-white/50">Withdraws public availability and blocks new playback authorizations. Existing signed links can remain valid until expiry.</p></form>
        <div className={panel}><h2 className="text-lg">Content status</h2>{data.products.map(product=><div key={product.id} className="mt-4 border-t border-white/10 pt-3 text-sm"><strong>{product.title}</strong><p className="text-white/50">{product.status} / {product.complianceStatus}</p><p className="mt-1 text-xs text-white/60">{data.reviews.find(r=>r.videoProductId===product.id)?.decision}</p>{data.notes.filter(n=>n.objectType==='VIDEO_PRODUCT'&&n.objectId===product.id).map(note=><p key={note.id} className="mt-2 text-xs text-white/50">{new Date(note.createdAt).toLocaleString('en-US')}: {note.body}</p>)}</div>)}</div>
      </div></section>}
    {tab === 'Audit log' && <section className={panel}><h2 className="text-lg">Compliance audit trail</h2><p className="mt-2 text-xs text-white/50">Latest events for this workspace. Raw documents and private contact details are excluded from audit metadata.</p><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['Time','Actor','Action','Object'].map(label=><th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{data.events.map(event=><tr key={event.id} className="border-t border-white/10"><td className="p-3 whitespace-nowrap">{new Date(event.createdAt).toLocaleString('en-US')}</td><td className="p-3">{event.userId || 'Public submission'}</td><td className="p-3">{event.action}</td><td className="p-3">{event.entityType}<br/>{event.entityId}</td></tr>)}</tbody></table></div></section>}
  </main>;
}
