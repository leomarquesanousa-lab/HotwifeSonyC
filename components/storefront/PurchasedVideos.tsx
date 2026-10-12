'use client';
import { useState } from 'react';
import Link from 'next/link';
import WatchFullVideo from './WatchFullVideo';

export function PurchasedVideo({ video, watchLabel = 'Watch' }: { video: { id: string; title: string }; watchLabel?: string }) {
  const [coverFailed, setCoverFailed] = useState(false);
  return <article className="store-purchase">
    <img src={coverFailed ? '/storefront/scene-1.svg' : `/api/account/videos/${encodeURIComponent(video.id)}/cover`} alt={`${video.title} cover`} width={640} height={360} style={{ width: '100%', height: 'auto', objectFit: 'cover' }} onError={() => setCoverFailed(true)}/>
    <h3>{video.title}</h3>
    <WatchFullVideo video={video} label={watchLabel}/>
  </article>;
}
export default function PurchasedVideos({ videos }: { videos: { id: string; title: string }[] }) {
  if (!videos.length) return <div className="store-empty"><h2>Your video library is waiting.</h2><p>Your purchased videos will appear here once payment is approved.</p><Link className="store-button" href="/videos">Explore Videos</Link></div>;
  return <div className="store-account-grid">{videos.map(video => <PurchasedVideo key={video.id} video={video}/>)}</div>;
}
