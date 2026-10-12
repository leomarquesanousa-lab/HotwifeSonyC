'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import styles from './HomeHero.module.css';

import { defaultBanners, type HomepageBanner } from '@/src/lib/homepage-banners/types';

export default function HomeHero({ children, slides = defaultBanners }: { children: ReactNode; slides?: HomepageBanner[] }) {
  const [active, setActive] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(true);
  const images = useRef<(HTMLImageElement | null)[]>([]);
  const request = useRef(0);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const goTo = useCallback(async (index: number) => {
    if (!slides.length) return;
    const next = (index + slides.length) % slides.length;
    const currentRequest = ++request.current;
    setTimerKey(key => key + 1);
    try {
      // Decode before fading in so a slow image never produces a blank slide.
      await images.current[next]?.decode();
      if (currentRequest === request.current) {
        setActive(next);
        setTimerKey(key => key + 1);
      }
    } catch { /* Keep the current slide if an image is unavailable. */ }
  }, [slides.length]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    updateMotion();
    updateVisibility();
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      media.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
      request.current++;
    };
  }, []);

  useEffect(() => {
    if (!slides.length || paused || hovered || focused || reducedMotion || !visible) return;
    const timer = window.setTimeout(() => void goTo(active + 1), 7000);
    return () => window.clearTimeout(timer);
  }, [active, timerKey, paused, hovered, focused, reducedMotion, visible, goTo, slides.length]);

  if (!slides.length) return null;
  return <section className={`store-hero ${styles.hero}`} style={{ marginLeft: 0, marginRight: 0, width: '100%' }}
    aria-label="Featured collection" aria-roledescription="carousel"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        void goTo(active + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    }}
    onTouchStart={event => { const point = event.touches[0]; touch.current = { x: point.clientX, y: point.clientY }; }}
    onTouchCancel={() => { touch.current = null; }}
    onTouchEnd={event => {
      const start = touch.current; touch.current = null;
      if (!start) return;
      const point = event.changedTouches[0];
      const dx = point.clientX - start.x;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(point.clientY - start.y)) void goTo(active + (dx < 0 ? 1 : -1));
    }}>
    <div className="store-hero-art">
      {slides.map((slide, index) => <img key={slide.src} ref={image => { images.current[index] = image; }}
        className={`${styles.slide} ${active === index ? styles.active : ''}`}
        src={slide.src} alt={slide.alt} width={slide.width} height={slide.height}
        aria-hidden={active !== index} loading={index === 0 ? 'eager' : 'lazy'}
        fetchPriority={index === 0 ? 'high' : 'low'} decoding="async"
        style={{ '--hero-position': `${slide.focal.x}% ${slide.focal.y}%`, '--hero-mobile-position': `${slide.mobileFocal.x}% ${slide.mobileFocal.y}%` } as React.CSSProperties}/>)}
      <span className="store-art-label">SONY C / VISUAL STORIES</span>
    </div>
    {children}
    <button className={`${styles.arrow} ${styles.previous}`} type="button" aria-label="Previous slide" onClick={() => void goTo(active - 1)}><ChevronLeft size={20}/></button>
    <button className={`${styles.arrow} ${styles.next}`} type="button" aria-label="Next slide" onClick={() => void goTo(active + 1)}><ChevronRight size={20}/></button>
    <div className={styles.controls} role="group" aria-label="Slideshow controls">
      {slides.map((slide, index) => <button key={slide.src} type="button" className={styles.dot}
        aria-label={`Show slide ${index + 1} of ${slides.length}`} aria-current={active === index ? 'true' : undefined}
        onClick={() => void goTo(index)}><span/></button>)}
      {!reducedMotion && <button className={styles.pause} type="button" aria-label={paused ? 'Resume slideshow' : 'Pause slideshow'} onClick={() => setPaused(value => !value)}>{paused ? <Play size={13}/> : <Pause size={13}/>}</button>}
    </div>
  </section>;
}
