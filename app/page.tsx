import type { Metadata } from 'next';
import { getPublishedVideos } from '@/src/lib/store/public';
export const dynamic = 'force-dynamic';
import Home from '@/components/storefront/Home';
import { StoreShell } from '@/components/storefront/Storefront';
import './(storefront)/storefront.css';
export const metadata: Metadata = { title: 'Sony C · The Private Collection', description: 'Discover an original collection of visual stories. Watch previews and buy the videos you love, one at a time.' };
export default async function RootPage() { const videos = await getPublishedVideos(); return <StoreShell><Home videos={videos}/></StoreShell>; }
