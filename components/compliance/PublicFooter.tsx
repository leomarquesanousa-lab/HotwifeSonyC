'use client';
import { usePathname } from 'next/navigation';
import LegalFooter from './LegalFooter';
import { legalLinks } from '@/src/lib/compliance/constants';
// Storefront and legal layouts already include the same footer in StoreShell.
export default function PublicFooter() {
  const path = usePathname().replace(/^\/en-US(?=\/)/, '');
  if (/^\/(app|onboarding)(\/|$)/.test(path) || path === '/' || /^\/(videos|checkout|my-videos|meus-videos|account|conta)(\/|$)/.test(path) || legalLinks.some(([, href]) => path === href) || path === '/data-deletion') return null;
  return <footer className="public-legal-footer"><LegalFooter/></footer>;
}
