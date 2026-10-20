'use client';
import { useEffect, useRef, useState } from 'react';

type Media = { id: string; originalFileName: string; mediaType: string };
export default function MediaPreviewModal({ media, onClose }: { media: Media; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const controller = new AbortController();
    const player = video.current;
    setUrl(''); setError('');
    void (async () => {
      try {
        const response = await fetch(`/api/media/${media.id}/preview`, { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success || !data.previewUrl) {
          throw new Error(response.status === 401 ? 'Your session expired. Sign in again.' : response.status === 403 ? 'Administrative permission is required.' : response.status === 404 ? 'This file is no longer available.' : response.status === 409 ? 'This file is not ready for playback.' : 'Preview is unavailable. Close and reopen to retry.');
        }
        if (!controller.signal.aborted) setUrl(data.previewUrl);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Preview unavailable.');
      }
    })();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const dialog = closeButton.current?.closest('[role="dialog"]');
        const elements = dialog?.querySelectorAll<HTMLElement>('button, video[controls]');
        const first = elements?.[0], last = elements?.[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      controller.abort();
      document.removeEventListener('keydown', keydown);
      if (player) { player.pause(); player.removeAttribute('src'); player.load(); }
      previousFocus?.focus();
    };
  }, [media.id, onClose]);
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby="media-preview-title" className="w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-[#0b1018]" onClick={event => event.stopPropagation()}>
      <header className="flex items-center justify-between gap-4 p-4"><h2 id="media-preview-title" className="truncate">Preview: {media.originalFileName}</h2><button ref={closeButton} onClick={onClose} className="min-h-11 px-4">Close preview</button></header>
      {error && <p role="alert" className="p-6 text-amber-200">{error}</p>}
      {!url && !error && <p role="status" className="p-6">Loading preview…</p>}
      {media.mediaType === 'IMAGE' ? url && !error && <img src={url} alt={media.originalFileName} className="max-h-[75vh] w-full object-contain" onError={() => setError('Image unavailable. Close and reopen to retry.')}/> : <video ref={video} src={url || undefined} hidden={!url || !!error} controls controlsList="nodownload" disablePictureInPicture playsInline autoPlay preload="metadata" onContextMenu={event => event.preventDefault()} onError={() => { if (url) setError('Video unavailable or unsupported by this browser. The file may be missing or the preview expired. Close and reopen to retry.'); }} className="max-h-[75vh] w-full bg-black"/>}
    </div>
  </div>;
}
