import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/lib/auth/session';
import { listPurchasedVideos } from '@/src/lib/store/purchases';
import PurchasedVideos from '@/components/storefront/PurchasedVideos';
export const metadata = { title: 'My Videos' };
export default async function Page() {
  if (!await getCurrentSession()) redirect('/login?next=/my-videos');
  const videos = await listPurchasedVideos();
  return <section className="store-section store-page"><span className="store-eyebrow">YOUR PERSONAL SPACE</span><h1>My Videos</h1><p className="store-lead">Your purchased videos, ready to watch.</p><nav className="store-account-nav"><Link href="/my-videos" aria-current="page">Purchased Videos</Link><Link href="/account">My Account</Link></nav><PurchasedVideos videos={videos}/></section>; }
