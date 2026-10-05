import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { priceLabel } from '@/components/storefront/data';
import { getPublishedVideo } from '@/src/lib/store/public';
export const metadata = { title: 'Demo Checkout' };
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
 const {slug} = await params; const video = await getPublishedVideo(slug); if (!video) notFound();
 return <section className="store-section store-page"><Link className="store-text-link" href={`/videos/${slug}`}><ArrowLeft size={16}/> Back to Video</Link><div className="store-checkout"><div><span className="store-eyebrow">YOUR SELECTION / 01</span><h1>Make this story yours.</h1><p className="store-lead">Review the video you’ve selected for your collection.</p><article className="store-order"><img src={video.thumbnail} alt={video.title} width="800" height="500"/><div><small>{video.category}</small><h2>{video.title}</h2><p>{video.duration} · One-time purchase</p></div><strong>{priceLabel(video.priceCents, video.currency)}</strong></article></div><aside className="store-purchase"><LockKeyhole size={28}/><h2>Order Summary</h2><div className="store-total"><span>1 video</span><strong>{priceLabel(video.priceCents, video.currency)}</strong></div><hr/><div className="store-total"><span>Total</span><strong>{priceLabel(video.priceCents, video.currency)}</strong></div><p className="store-notice">This is a preview of the checkout experience. Payments and orders are not available yet.</p><button className="store-button" disabled>Purchases Coming Soon</button><Link className="store-text-link" href="/videos">Keep Exploring</Link><p className="store-fine">This demo does not create an order, grant access, or charge you.</p></aside></div></section>;
}
