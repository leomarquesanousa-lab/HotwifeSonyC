'use client';
import { useState } from 'react';
import Link from 'next/link';

function PurchasedVideo({ video }: { video: { id: string; title: string } }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [coverFailed, setCoverFailed] = useState(false);
  async function watch() {
    setBusy(true); setError(''); setUrl(null);
    try {
      const response = await fetch(`/api/account/videos/${encodeURIComponent(video.id)}/watch`, { method: 'POST', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || typeof data.url !== 'string') throw new Error(data.error || 'Unable to play this video.');
      setUrl(data.url);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to play this video.'); }
    finally { setBusy(false); }
  }
  return <article className="store-purchase">
    <img src={coverFailed ? '/storefront/scene-1.svg' : `/api/account/videos/${encodeURIComponent(video.id)}/cover`} alt={`${video.title} cover`} width={640} height={360} style={{ width: '100%', height: 'auto', objectFit: 'cover' }} onError={() => setCoverFailed(true)}/>
    <h3>{video.title}</h3>
    <button className="store-button" type="button" disabled={busy} onClick={watch}>{busy ? 'Loading…' : 'Watch'}</button>
    {error && <p role="alert">{error}</p>}
    {url && <video key={url} src={url} controls autoPlay controlsList="nodownload" disablePictureInPicture preload="metadata" aria-label={`Watch ${video.title}`} style={{ width: '100%', marginTop: '1rem' }} onError={() => setError('Playback unavailable. Select Watch to request a new playback session.')}/>}
  </article>;
}
export default function PurchasedVideos({ videos }: { videos: { id: string; title: string }[] }) {
  if (!videos.length) return <div className="store-empty"><h2>Your video library is waiting.</h2><p>Your purchased videos will appear here once payment is approved.</p><Link className="store-button" href="/videos">Explore Videos</Link></div>;
  return <div className="store-account-grid">{videos.map(video => <PurchasedVideo key={video.id} video={video}/>)}</div>;
}
