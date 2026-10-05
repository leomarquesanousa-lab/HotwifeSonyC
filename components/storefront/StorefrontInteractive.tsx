'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Search, RotateCcw, ArrowUpRight, LockKeyhole } from 'lucide-react';
import { priceLabel, type VideoProduct } from './data';
import { VideoCard } from './Storefront';
export function Catalog({ initialCategory, videos }: { initialCategory: string; videos: VideoProduct[] }) {
  const categories = [...new Set(videos.map(video => video.category))];
  const [category,setCategory] = useState(categories.includes(initialCategory) ? initialCategory : 'All Categories');
  const [query,setQuery] = useState('');
  const [sort,setSort] = useState('recent');
  const items = videos.filter(video => (category === 'All Categories' || video.category === category) && `${video.title} ${video.category} ${video.tags.join(' ')}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())).sort((a,b) => sort === 'price' ? a.priceCents-b.priceCents : sort === 'featured' ? Number(b.featured)-Number(a.featured) : b.publishedAt.localeCompare(a.publishedAt));
  return <><div className="store-filters"><label className="store-search"><Search size={19}/><input type="search" aria-label="Search videos" placeholder="Search videos..." value={query} onChange={e => setQuery(e.target.value)}/></label><label className="store-sort">Sort by <select value={sort} onChange={e => setSort(e.target.value)}><option value="recent">New Releases</option><option value="featured">Featured</option><option value="price">Price: Low to High</option></select></label></div><div className="store-filter-tabs" aria-label="Categories">{['All Categories',...categories].map(item => <button key={item} aria-pressed={item === category} onClick={() => setCategory(item)}>{item}</button>)}</div><p className="store-result" aria-live="polite">{items.length} videos in the collection</p><div className="store-grid">{items.map(video => <VideoCard key={video.id} video={video}/>)}</div>{!items.length && <div className="store-empty"><Search size={30}/><h2>{videos.length ? 'No videos found' : 'New stories are on the way'}</h2><p>{videos.length ? 'Try a different search or category.' : 'Check back soon for new releases.'}</p>{videos.length > 0 && <button className="store-button" onClick={() => {setQuery('');setCategory('All Categories');}}>Clear Filters</button>}</div>}</>;
}
export function Teaser({ video }: { video: VideoProduct }) {
  const player = useRef<HTMLVideoElement>(null);
  const [ended,setEnded] = useState(false);
  const [failed,setFailed] = useState(false);
  return <div className="store-teaser">{video.teaser.source && !failed ? <video ref={player} src={video.teaser.source} poster={video.thumbnail} controls playsInline preload="metadata" aria-label={`Preview of ${video.title}`} onEnded={() => setEnded(true)} onError={() => setFailed(true)}/> : <><img src={video.thumbnail} alt={`Cover artwork for ${video.title}`} width="800" height="500"/><div className="store-teaser-controls"><span>{failed ? 'Preview temporarily unavailable' : 'No preview available for this video'}</span><span>Explore the details below</span></div></>}{video.teaser.source && !failed && <span className="store-badge">VIDEO PREVIEW</span>}{ended && <div className="store-teaser-overlay"><LockKeyhole size={30}/><h2>The story continues.</h2><p>Full video · {video.duration}</p><strong>{priceLabel(video.priceCents, video.currency)}</strong><Link className="store-button" href={`/checkout/${video.slug}`}>Buy Video <ArrowUpRight size={18}/></Link><button className="store-text-link" onClick={() => {setEnded(false);if(player.current){player.current.currentTime=0;void player.current.play().catch(() => {});}}}><RotateCcw size={16}/> Replay Preview</button></div>}</div>;
}
