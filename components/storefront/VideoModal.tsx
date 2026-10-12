'use client';

import { useEffect, useId, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './VideoModal.module.css';

export default function VideoModal({ title, url, busy, error, onClose, onPlaybackError, triggerRef }: {
  title: string; url: string | null; busy: boolean; error: string;
  onClose: () => void; onPlaybackError: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    if (!dialog) return;
    const body = document.body;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const properties = ['position', 'top', 'left', 'right', 'overflow', 'paddingRight'] as const;
    const previous = Object.fromEntries(properties.map(key => [key, body.style[key]]));
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const padding = parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';
    body.style.paddingRight = `${padding + scrollbar}px`;
    dialog.showModal();
    return () => {
      dialog.close();
      for (const key of properties) body.style[key] = previous[key];
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
      trigger?.focus({ preventScroll: true });
    };
  }, [triggerRef]);

  return createPortal(<dialog ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <header className={styles.header}><h2 id={titleId}>{title}</h2><button className={styles.close} type="button" aria-label="Close video" autoFocus onClick={onClose}><X size={24}/></button></header>
    <div className={styles.content}>
      {busy && <p role="status">Loading video...</p>}
      {error && <p role="alert">{error}</p>}
      {url && <video key={url} className={styles.video} src={url} controls autoPlay controlsList="nodownload" disablePictureInPicture preload="metadata" aria-label={`Watch ${title}`} onError={onPlaybackError}/>}
    </div>
  </dialog>, document.body);
}
