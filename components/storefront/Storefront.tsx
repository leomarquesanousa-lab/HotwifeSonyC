import Link from 'next/link';
import { ArrowUpRight, Play, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { creator, priceLabel, type VideoProduct } from './data';
export function StoreShell({ children }: { children: ReactNode }) {
  return <div className="store" lang="en"><a className="store-skip" href="#conteudo">Skip to content</a><header className="store-header"><Link className="store-logo" href="/">sony<span>c.</span><small>THE PRIVATE COLLECTION</small></Link><nav aria-label="Main navigation"><Link href="/">Home</Link><Link href="/videos">Explore Videos</Link><Link href="/my-videos">My Videos</Link></nav><Link className="store-login" href="/account">My Account <ArrowUpRight size={16}/></Link></header><main id="conteudo" className="store-main">{children}</main><footer className="store-footer"><div><Link className="store-logo" href="/">sony<span>c.</span></Link><p>Visual stories. A unique perspective.</p></div><div><Link href="/videos">Video Catalog</Link><Link href="/account">My Account</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div><small>© {new Date().getFullYear()} {creator.name} · Video store · Demo checkout</small></footer></div>;
}
export function VideoCard({ video }: { video: VideoProduct }) {
  return <article className="store-card"><Link className="store-thumb" href={`/videos/${video.slug}`} aria-label={`View details for ${video.title}`}><img src={video.thumbnail} alt={`Artwork for ${video.title}`} loading="lazy" width="800" height="500"/>{video.badge && <span className="store-badge">{video.badge}</span>}<span className="store-card-play"><Play size={20}/></span><span className="store-duration">{video.duration}</span></Link><div className="store-card-info"><small>{video.category}</small><h3><Link href={`/videos/${video.slug}`}>{video.title}</Link></h3><div><strong>{priceLabel(video.priceCents, video.currency)}</strong><Link href={`/videos/${video.slug}`}>View Details <ArrowUpRight size={15}/></Link></div></div></article>;
}
export function VideoSection({ title, label, items }: { title: string; label: string; items: VideoProduct[] }) {
  if (!items.length) return null;
  return <section className="store-section"><div className="store-section-heading"><div><span className="store-eyebrow">{label}</span><h2>{title}</h2></div><Link className="store-text-link" href="/videos">View All <ArrowUpRight size={17}/></Link></div><div className="store-grid">{items.map(video => <VideoCard key={video.id} video={video}/>)}</div></section>;
}
export function JoinBanner() { return <section className="store-join"><Sparkles size={26}/><div><h2>Your next favorite moment awaits.</h2><p>Discover the collection and make room for the stories you love.</p></div><Link className="store-button" href="/sign-up">Create Account <ArrowUpRight size={18}/></Link><Link className="store-text-link" href="/login">Sign In</Link></section>; }
