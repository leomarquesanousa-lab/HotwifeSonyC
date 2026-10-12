import type { Metadata } from 'next';
import Link from 'next/link';
import { policies } from '@/src/lib/compliance/policies';
import { legalConfiguration } from '@/src/lib/compliance/config';
import { legalLinks, policyGroups } from '@/src/lib/compliance/constants';
import ReportForm from './ReportForm';

export function policyMetadata(slug: string): Metadata {
  const policy = policies()[slug];
  const title = slug === 'compliance' ? 'Safety & Compliance' : policy.title;
  const description = slug === 'compliance' ? 'Our commitment to lawful, consensual, adult-only content and responsible platform operation.' : policy.description;
  return { title: `${title} | HotwifeSonyC`, description, alternates: { canonical: `https://hotwifesonyc.com/${slug}` }, openGraph: { title, description, url: `https://hotwifesonyc.com/${slug}`, locale: 'en_US', type: 'website' } };
}
export default function PolicyPage({ slug }: { slug: string }) {
  const legal = legalConfiguration();
  if (slug === 'compliance') return <article className="legal-page" lang="en"><header><span className="store-eyebrow">HOTWIFESONYC</span><h1>Safety & Compliance</h1><p className="legal-lead">Our commitment to lawful, consensual, adult-only content and responsible platform operation.</p><small>Last updated: {legal.updated}</small></header><div className="legal-groups">{policyGroups.map(group => <section key={group.title}><h2>{group.title}</h2><div className="legal-cards">{group.paths.map(path => <Link href={path} key={path}><strong>{policies()[path.slice(1)].title}</strong><span>{policies()[path.slice(1)].description}</span></Link>)}</div></section>)}</div><aside className="legal-callout"><h2>Questions or concerns?</h2><p>Report content or request a consent review without an account. These policies and review controls do not guarantee payment-processor approval or represent a regulatory certification.</p><Link className="store-text-link" href="/report-content">Report Content →</Link> <Link className="store-text-link" href="/contact">Contact / Support →</Link></aside></article>;
  const policy = policies()[slug];
  const anchor = (index: number) => `section-${index + 1}`;
  return <article className="legal-page" lang="en"><header><Link className="store-text-link" href="/compliance">← Safety & Compliance</Link><h1>{policy.title}</h1><p className="legal-lead">{policy.description}</p><small>Last updated: {legal.updated}</small></header>
    <div className="legal-layout"><aside className="legal-toc"><nav aria-label="On this page"><strong>On this page</strong>{policy.sections.map((section, index) => <a key={section.title} href={`#${anchor(index)}`}>{section.title}</a>)}</nav></aside><div className="legal-body">{policy.sections.map((section, index) => <section key={section.title} id={anchor(index)}><h2>{section.title}</h2>{section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{section.items && <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>}</section>)}
      {['report-content', 'depicted-person-removal', 'contact'].includes(slug) && <ReportForm kind={slug === 'contact' ? 'SUPPORT' : slug === 'depicted-person-removal' ? 'DEPICTED_PERSON' : 'CONTENT'}/>}
      <nav className="legal-related" aria-label="Related policies">{legalLinks.filter(([, href]) => href !== `/${slug}`).map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</nav>
    </div></div></article>;
}
