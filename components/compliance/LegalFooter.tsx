import Link from 'next/link';
import { legalLinks } from '@/src/lib/compliance/constants';
export default function LegalFooter() {
  return <div className="legal-footer" lang="en"><nav aria-label="Legal, safety and support">{legalLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav><p>Adults only / 18+ or legal age in your jurisdiction</p></div>;
}
