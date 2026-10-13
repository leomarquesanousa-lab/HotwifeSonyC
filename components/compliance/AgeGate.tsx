'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';

let memoryAcknowledgment = false;
const entryKey = 'hotwifesonyc:adult-entry:v1';
function acknowledged() { try { return memoryAcknowledgment || sessionStorage.getItem(entryKey) === 'yes'; } catch { return memoryAcknowledgment; } }
function subscribe(callback: () => void) { window.addEventListener('adult-entry-change', callback); return () => window.removeEventListener('adult-entry-change', callback); }
export default function AgeGate() {
  const path = usePathname();
  const gated = path === '/' || /^\/(videos|checkout)(\/|$)/.test(path);
  const accepted = useSyncExternalStore(subscribe, acknowledged, () => false);
  const [legalAge, setLegalAge] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!gated || accepted) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, [gated, accepted]);
  if (!gated || accepted) return null;
  return <div className="age-gate-shield"><dialog ref={dialogRef} className="age-gate" aria-modal="true" aria-labelledby="adult-entry-title" aria-describedby="adult-entry-description" onCancel={event => event.preventDefault()}>
    <header className="age-gate-brand"><Image src="/logo-hotwifesonyc.png" alt="HotwifeSonyC" width={180} height={56} sizes="148px" loading="eager"/><span>A private collection</span></header>
    <div className="age-gate-intro"><span className="age-gate-badge">18+</span><p className="age-gate-eyebrow">An invitation to explore</p><h2 id="adult-entry-title">Adults only<span>.</span></h2><p id="adult-entry-description">This website contains age-restricted adult content. You must be at least 18, or the legal age in your jurisdiction, to enter.</p></div>
    <div className="age-gate-confirmations">
      <label><input type="checkbox" checked={legalAge} onChange={event => setLegalAge(event.target.checked)}/><span>I confirm that I am 18 years of age or older.</span></label>
    </div>
    <div className="age-gate-actions"><button type="button" className="age-gate-enter" disabled={!legalAge} onClick={() => { memoryAcknowledgment = true; try { sessionStorage.setItem(entryKey, 'yes'); } catch {} window.dispatchEvent(new Event('adult-entry-change')); }}>Enter Site<ArrowUpRight size={18} aria-hidden="true"/></button><a className="age-gate-exit" href="https://www.google.com/" rel="noreferrer">Exit</a></div>
    <footer className="age-gate-footer"><p><ShieldCheck size={14} aria-hidden="true"/>Your choice is remembered for this session.</p><nav aria-label="Age gate legal and safety links"><Link href="/age-verification">Age policy</Link><Link href="/compliance">Safety & Compliance</Link><Link href="/report-content">Report content</Link></nav><small>This confirmation is not identity or age verification.</small></footer>
  </dialog></div>;
}
