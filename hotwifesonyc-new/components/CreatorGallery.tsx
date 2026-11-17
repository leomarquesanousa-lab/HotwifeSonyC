'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

type Photograph = {src:string; name:string; alt:string; position:string};

export default function CreatorGallery({ photos }: { photos: Photograph[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const open = index !== null;
  const photo = index === null ? null : photos[index];
  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, [open]);
  const move = (direction:number) => setIndex(current => current === null ? null : (current + direction + photos.length) % photos.length);

  if (!photos.length) return <p className="creator-gallery-empty">A new collection of photographs is coming soon.</p>;
  return <>
    <div className="creator-gallery">
      {photos.map((item, i) => <button type="button" className="creator-thumbnail" key={item.name} aria-label={`Open photograph ${i + 1}: ${item.alt}`} aria-haspopup="dialog" onClick={() => setIndex(i)}>
        <Image src={item.src} alt={item.alt} fill loading="lazy" sizes="(max-width: 600px) 45vw, (max-width: 1100px) 30vw, (min-width: 1800px) 310px, 18vw" style={{objectPosition:item.position}}/>
        <span className="creator-photo-open" aria-hidden="true">↗</span>
      </button>)}
    </div>
    <dialog ref={dialog} className="creator-lightbox" aria-label="Creator Picks photo viewer" onClose={() => setIndex(null)} onClick={event => {if(event.target === event.currentTarget)dialog.current?.close();}} onKeyDown={event => {if(event.key === 'ArrowRight' || event.key === 'ArrowLeft'){event.preventDefault();move(event.key === 'ArrowRight' ? 1 : -1);}}}>
      <button type="button" className="creator-close" aria-label="Close photo viewer" autoFocus onClick={() => dialog.current?.close()}>×</button>
      {photo && <div className="creator-full-photo"><Image key={photo.src} src={photo.src} alt={photo.alt} fill unoptimized sizes="100vw"/></div>}
      {photos.length > 1 && <><button type="button" className="creator-previous" aria-label="Previous photograph" onClick={() => move(-1)}>←</button><button type="button" className="creator-next" aria-label="Next photograph" onClick={() => move(1)}>→</button></>}
      <p className="creator-counter" aria-live="polite">{index === null ? '' : `${index + 1} / ${photos.length}`}</p>
    </dialog>
  </>;
}
