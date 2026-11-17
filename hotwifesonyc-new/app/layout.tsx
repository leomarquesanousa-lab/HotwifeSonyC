import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import AgeBoundary from '../components/AgeBoundary';
import Navigation from '../components/Navigation';
import './globals.css';
import './studio.css';
export const metadata: Metadata = { title: { default: 'HotwifeSonyC — One Vision. Endless Stories', template: '%s | HotwifeSonyC' }, description: 'Meet Sony C. Explore photographs, creator picks, a video catalog, and links to her external platforms.', robots: { index: !!process.env.SITE_URL, follow: !!process.env.SITE_URL }, ...(process.env.SITE_URL?{metadataBase:new URL(process.env.SITE_URL)}:{}) };
export default async function Layout({ children }: { children: React.ReactNode }) {
  const accepted=(await cookies()).get('sony_age')?.value==='confirmed';
  return <html lang="en"><body><AgeBoundary accepted={accepted}><a className="skip" href="#main">Skip to content</a><Navigation/>{children}<footer className="site-footer"><div className="footer-inner"><Link className="footer-brand" href="/"><Image className="original-logo" src="/images/logo-hotwifesonyc.png" alt="HotwifeSonyC" width={2137} height={736} unoptimized/><span>One Vision. Endless Stories</span></Link><p>© {new Date().getFullYear()} HotwifeSonyC<br/>For audiences 18 and over.</p><div className="footer-links"><Link href="/#platforms">Platforms ↗</Link><Link href="/admin">Administration</Link></div></div></footer></AgeBoundary></body></html>;
}
