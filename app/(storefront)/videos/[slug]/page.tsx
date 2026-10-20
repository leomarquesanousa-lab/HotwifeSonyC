import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Clock, Film } from 'lucide-react';
import { getCurrentSession } from '@/src/lib/auth/session';
import { canWatchVideo } from '@/src/lib/store/purchases';
import WatchFullVideo from '@/components/storefront/WatchFullVideo';
import { priceLabel } from '@/components/storefront/data';
import { getPublishedVideo, getPublishedVideos } from '@/src/lib/store/public';
import { Teaser } from '@/components/storefront/StorefrontInteractive';
import { VideoSection } from '@/components/storefront/Storefront';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: (await getPublishedVideo(slug))?.title ?? 'Video Not Found' };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const video = await getPublishedVideo(slug);
  if (!video) notFound();
  const auth = await getCurrentSession();
  const access = auth ? await canWatchVideo(video.id) : false;
  const videos = await getPublishedVideos();
  const next = encodeURIComponent(`/videos/${video.slug}`);
  return <><section className="store-section store-page">
    <Link className="store-text-link" href="/videos"><ArrowLeft size={16}/> Back to Collection</Link>
    <div className="store-detail"><div><Teaser video={video}/><div className="store-description">
      <span className="store-eyebrow">ABOUT THIS VIDEO</span><h2>{video.title}</h2><p>{video.description}</p>
      <div className="store-tags">{video.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
    </div></div><aside className="store-purchase">
      <span className="store-eyebrow">{video.category} / SONY C</span><h1>{video.title}</h1>
      <p>Personal streaming access to this video. No subscription or downloads. <Link href="/terms">Access terms</Link> apply.</p>
      <div className="store-video-meta"><span><Clock size={17}/>{video.duration}</span><span><Film size={17}/>Single video</span></div><hr/>
      {access ? <WatchFullVideo video={video} label="Watch Video"/> : <>
        <p>This Video Is Locked. Purchase this video to unlock the full content.</p>
        <small>ONE-TIME PURCHASE</small><strong className="store-price">{priceLabel(video.priceCents, video.currency)} <small>{video.currency}</small></strong>
        {!auth && <p><Link className="store-text-link" href={`/login?next=${next}`}>Sign In</Link> or <Link className="store-text-link" href={`/sign-up?next=${next}`}>Create Account</Link> before purchasing.</p>}
        <Link className="store-button" href={`/checkout/${video.slug}`} aria-describedby="checkout-status">Buy This Video <ArrowUpRight size={18}/></Link>
        <p id="checkout-status" className="store-notice">Checkout coming soon. Payments are currently unavailable.</p>
      </>}
      <div className="store-content-info"><strong>Video Details</strong><p>Creator: Sony C<br/>Category: {video.category}<br/>Preview: {video.teaser.source ? 'Available' : 'Not available'}<br/>Original video content</p></div>
    </aside></div>
  </section><VideoSection label="KEEP EXPLORING" title="You May Also Like" items={videos.filter(item => item.id !== video.id).sort((a,b) => Number(b.category === video.category)-Number(a.category === video.category)).slice(0,4)}/></>;
}
