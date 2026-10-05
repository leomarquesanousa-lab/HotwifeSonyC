import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, Film, UserRound } from 'lucide-react';
import { getCurrentSession } from '@/src/lib/auth/session';
import SignOutButton from '@/components/storefront/SignOutButton';
import PurchasedVideos from '@/components/storefront/PurchasedVideos';
import { listPurchasedVideos } from '@/src/lib/store/purchases';
export const metadata = { title: 'My Account' };
export default async function Page() {
  const auth = await getCurrentSession();
  if (!auth) redirect('/login?next=/account');
  const name = [auth.user.firstName, auth.user.lastName].filter(Boolean).join(' ');
  const videos = await listPurchasedVideos();
  return <section className="store-section store-page">
    <span className="store-eyebrow">YOUR PERSONAL SPACE</span><h1>My Account</h1>
    <p className="store-lead">Your account and your personal video collection.</p>
    <nav className="store-account-nav"><Link href="/my-videos">Purchased Videos</Link><Link href="/account" aria-current="page">My Account</Link></nav>
    <div className="store-account-grid">
      <article className="store-purchase"><UserRound size={32}/><h2>Account Details</h2>
        <dl><dt>Name</dt><dd>{name || 'Not provided'}</dd><dt>Email</dt><dd className="break-all">{auth.user.email}</dd></dl>
        <SignOutButton/>
      </article>
      <article className="store-purchase"><Film size={32}/><h2>Your Video Library</h2>
        <p>Watch your purchased videos in your personal library.</p>
        <Link className="store-button" href="/my-videos">My Videos <ArrowUpRight size={18}/></Link>
      </article>
    </div>
    <PurchasedVideos videos={videos}/>
  </section>;
}
