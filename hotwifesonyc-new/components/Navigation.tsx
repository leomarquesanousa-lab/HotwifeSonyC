'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
const items = [['Home', '/'], ['Meet Sony C', '/#meet'], ['Creator Picks', '/#picks'], ['Video Catalog', '/catalog'], ['Platforms', '/#platforms']];
function subscribeHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => { window.removeEventListener('hashchange', onChange); window.removeEventListener('popstate', onChange); };
}
export default function Navigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => '');
  return <header className="header"><div className="header-inner" onKeyDown={event => { if(event.key === 'Escape') setOpen(false); }}>
    <Link className="brand" href="/" aria-label="HotwifeSonyC home"><Image className="original-logo" src="/images/logo-hotwifesonyc.png" alt="HotwifeSonyC" width={2137} height={736} unoptimized preload/></Link>
    <span className="header-note">THE WORLD OF SONY C ↗</span>
    <button className="menu-toggle" aria-expanded={open} aria-controls="navigation" onClick={() => setOpen(!open)}>{open ? 'Close −' : 'Menu +'}</button>
    <nav id="navigation" className={open ? 'nav open' : 'nav'} aria-label="Main navigation">{items.map(([name, href]) => {
      const section = href.includes('#');
      const active = section ? pathname === '/' && hash === href.slice(1) : pathname === href && (href !== '/' || !hash || hash === '#main');
      return section ? <a key={name} href={href} aria-current={active ? 'location' : undefined} onClick={() => setOpen(false)}>{name}</a> : <Link key={name} href={href} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)}>{name}</Link>;
    })}</nav>
  </div></header>;
}
