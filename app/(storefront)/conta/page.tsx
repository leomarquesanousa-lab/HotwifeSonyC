import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Film, UserRound } from 'lucide-react';
import { getCurrentSession } from '@/src/lib/auth/session';
import SignOutButton from '@/components/storefront/SignOutButton';
import PurchasedVideos from '@/components/storefront/PurchasedVideos';
import { listPurchasedVideos } from '@/src/lib/store/purchases';
import styles from './account.module.css';
export const metadata = { title: 'My Account' };
export default async function Page() {
  const auth = await getCurrentSession();
  if (!auth) redirect('/login?next=/account');
  const name = [auth.user.firstName, auth.user.lastName].filter(Boolean).join(' ');
  const videos = await listPurchasedVideos();
  return <section className={`store-section store-page ${styles.page}`}>
    <header className={styles.heading}>
      <h1>My Account</h1>
      <p>Your details and your private collection.</p>
    </header>
    <section className={styles.details} aria-labelledby="account-details-title">
      <div className={styles.detailsTitle}><UserRound size={20} aria-hidden="true"/><h2 id="account-details-title">Account Details</h2></div>
      <dl className={styles.fields}>
        <div><dt>Name</dt><dd>{name || 'Not provided'}</dd></div>
        <div><dt>Email</dt><dd>{auth.user.email}</dd></div>
      </dl>
      <div className={styles.signOut}><SignOutButton/></div>
    </section>
    <section className={styles.library} aria-labelledby="purchased-videos-title">
      <h2 id="purchased-videos-title">Purchased Videos</h2>
      {videos.length ? <PurchasedVideos videos={videos}/> : <div className={styles.empty}>
        <span className={styles.emptyIcon}><Film size={24} aria-hidden="true"/></span>
        <h3>Your collection starts here.</h3>
        <p>Your purchased videos will be ready to watch here.</p>
        <Link className="store-button" href="/videos">Explore Videos</Link>
      </div>}
    </section>
  </section>;
}
