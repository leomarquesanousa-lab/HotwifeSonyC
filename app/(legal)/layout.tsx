import type { ReactNode } from 'react';
import { StoreShell } from '@/components/storefront/Storefront';
import '../(storefront)/storefront.css';
export default function LegalLayout({ children }: { children: ReactNode }) { return <StoreShell>{children}</StoreShell>; }
