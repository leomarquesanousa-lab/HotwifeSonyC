'use client';

import { useCallback, useRef, useState } from 'react';
import VideoModal from './VideoModal';

export default function WatchFullVideo({ video, label = 'Watch', className = 'store-button' }: {
  video: { id: string; title: string }; label?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const close = useCallback(() => {
    requestRef.current?.abort();
    setOpen(false); setUrl(null); setError(''); setBusy(false);
  }, []);

  async function watch() {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    setOpen(true); setBusy(true); setError(''); setUrl(null);
    try {
      const response = await fetch(`/api/account/videos/${encodeURIComponent(video.id)}/watch`, { method: 'POST', cache: 'no-store', signal: request.signal });
      const data = await response.json();
      if (!response.ok || typeof data.url !== 'string') throw new Error(data.error || 'Unable to play this video.');
      if (!request.signal.aborted) setUrl(data.url);
    } catch (failure) {
      if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to play this video.');
    } finally { if (!request.signal.aborted) setBusy(false); }
  }

  return <>
    <button ref={triggerRef} className={className} type="button" aria-haspopup="dialog" onClick={watch}>{label}</button>
    {open && <VideoModal title={video.title} url={url} busy={busy} error={error} onClose={close} triggerRef={triggerRef}
      onPlaybackError={() => setError('Playback unavailable. Close and select Watch to request a new playback session.')}/>}
  </>;
}
