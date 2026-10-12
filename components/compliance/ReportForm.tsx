'use client';
import { useState, type FormEvent } from 'react';
import { reportReasons } from '@/src/lib/compliance/constants';

export default function ReportForm({ kind = 'CONTENT' }: { kind?: 'CONTENT' | 'DEPICTED_PERSON' | 'SUPPORT' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ reference: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/compliance/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ kind, contentUrl: form.get('contentUrl') || 'https://hotwifesonyc.com/', reason: form.get('reason') || 'Other', reporterName: form.get('reporterName'), reporterEmail: form.get('reporterEmail'), depictedPerson: kind === 'DEPICTED_PERSON' || form.get('depictedPerson') === 'yes', description: form.get('description'), supportingInfo: form.get('supportingInfo') || '', website: form.get('website') || '', truthful: form.get('truthful') === 'on' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Submission could not be recorded. Please try again.');
      setResult(data);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Submission could not be recorded.'); }
    finally { setBusy(false); }
  }
  if (result) return <section className="legal-callout" role="status"><h2>Request received</h2><p>Your request was recorded for human review. Keep this reference for follow-up:</p><strong className="legal-reference">{result.reference}</strong><p>This is not an automatic decision or an email confirmation. For immediate danger, contact local emergency services.</p><button className="store-button secondary" onClick={() => setResult(null)}>Submit another request</button></section>;
  return <section className="legal-form-section" aria-labelledby="report-form-title"><h2 id="report-form-title">{kind === 'SUPPORT' ? 'Contact support' : kind === 'DEPICTED_PERSON' ? 'Request a consent review or removal' : 'Submit a content report'}</h2>
    <p>No account required. Do not submit graphic descriptions, identity documents, card details or unlawful media. Optional supporting information can describe documentation available for protected follow-up.</p>
    <form className="legal-form" onSubmit={submit}>
      <label>{kind === 'SUPPORT' ? 'Related page URL (optional)' : 'URL of content'}<input name="contentUrl" type="url" placeholder="https://hotwifesonyc.com/videos/example" required={kind !== 'SUPPORT'} maxLength={2000}/></label>
      {kind !== 'SUPPORT' && <label>Reason<select name="reason" required defaultValue={kind === 'DEPICTED_PERSON' ? 'Non-consensual content' : ''}><option value="" disabled>Select a reason</option>{reportReasons.map(reason => <option key={reason}>{reason}</option>)}</select></label>}
      <div className="legal-field-row"><label>{kind === 'DEPICTED_PERSON' ? 'Legal name' : 'Your name'}<input name="reporterName" autoComplete="name" required minLength={2} maxLength={160}/></label><label>Contact email<input name="reporterEmail" type="email" autoComplete="email" required maxLength={255}/></label></div>
      {kind === 'CONTENT' && <label>Are you depicted in the content?<select name="depictedPerson" defaultValue="no"><option value="no">No</option><option value="yes">Yes</option></select></label>}
      <label>{kind === 'DEPICTED_PERSON' ? 'Explain your concern and requested action' : kind === 'SUPPORT' ? 'How can we help? Include any existing request reference.' : 'Description of concern'}<textarea name="description" required minLength={20} maxLength={6000} rows={6}/></label>
      <label>Supporting information (optional; no document uploads)<textarea name="supportingInfo" maxLength={3000} rows={3}/></label>
      <div className="legal-honeypot" aria-hidden="true"><label>Leave blank<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
      <label className="legal-check"><input name="truthful" type="checkbox" required/> I believe this information is accurate and understand it will be used to review and respond to this request as described in the Privacy Policy.</label>
      {error && <p role="alert">{error}</p>}<button type="submit" className="store-button" disabled={busy}>{busy ? 'Submitting...' : 'Submit request'}</button>
    </form>
  </section>;
}
