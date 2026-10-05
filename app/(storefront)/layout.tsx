import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StoreShell } from '@/components/storefront/Storefront';
import './storefront.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'HotwifeSonyC · The Private Collection', template: '%s · Sony C' }, description: 'Discover an original collection of visual stories. Watch previews and buy the videos you love, one at a time.' };
export default function Layout({ children }: { children: ReactNode }) { return <StoreShell>{children}</StoreShell>; }
