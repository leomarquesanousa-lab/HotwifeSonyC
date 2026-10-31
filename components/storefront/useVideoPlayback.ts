'use client';

import { useEffect, useRef, type RefObject } from 'react';

type PlayerKind = 'teaser' | 'full';
type MetricName = 'authorization' | 'load' | 'startup' | 'buffering' | 'interruption' | 'error';

// Ephemeral, local diagnostics only. Never include URLs, IDs, titles, error text,
// playback position or user information. No storage, console or network transport.
export function playbackMetric(player: PlayerKind, metric: MetricName, milliseconds: number, interruptions = 0) {
  window.dispatchEvent(new CustomEvent('hotwifesonyc:playback-metric', {
    detail: Object.freeze({ player, metric, milliseconds: Math.max(0, Math.round(milliseconds)), interruptions }),
  }));
}

export function pauseOtherVideos(selected?: HTMLVideoElement) {
  document.querySelectorAll('video').forEach(video => {
    if (video !== selected && !video.paused) video.pause();
  });
}

export function useVideoPlayback(ref: RefObject<HTMLVideoElement | null>, kind: PlayerKind, source: string | null) {
  const started = useRef<number | null>(null);
  const waiting = useRef<number | null>(null);
  const loaded = useRef<number | null>(null);
  const hasPlayed = useRef(false);
  const interruptions = useRef(0);

  useEffect(() => {
    started.current = waiting.current = loaded.current = null;
    hasPlayed.current = false;
    interruptions.current = 0;
    // Capture also covers native controls and players outside these components.
    const select = (event: Event) => {
      if (event.target instanceof HTMLVideoElement) pauseOtherVideos(event.target);
    };
    document.addEventListener('play', select, true);
    return () => {
      document.removeEventListener('play', select, true);
      if (waiting.current !== null) playbackMetric(kind, 'buffering', performance.now() - waiting.current, interruptions.current);
      waiting.current = null;
    };
  }, [source, kind]);

  const finishWaiting = () => {
    if (waiting.current !== null) playbackMetric(kind, 'buffering', performance.now() - waiting.current, interruptions.current);
    waiting.current = null;
  };

  return {
    onLoadStart: () => { loaded.current = performance.now(); },
    onLoadedMetadata: () => {
      if (loaded.current !== null) playbackMetric(kind, 'load', performance.now() - loaded.current);
    },
    onPlay: () => {
      pauseOtherVideos(ref.current ?? undefined);
      if (!hasPlayed.current && started.current === null) started.current = performance.now();
    },
    onPlaying: () => {
      if (!hasPlayed.current && started.current !== null) playbackMetric(kind, 'startup', performance.now() - started.current);
      hasPlayed.current = true;
      finishWaiting();
    },
    onWaiting: () => {
      const video = ref.current;
      // Initial buffering is covered by startup. Seeking and deliberate pauses
      // must not inflate the count of interruptions during playback.
      if (!video || video.paused || video.seeking || !hasPlayed.current || waiting.current !== null) return;
      waiting.current = performance.now();
      interruptions.current++;
      playbackMetric(kind, 'interruption', 0, interruptions.current);
    },
    onSeeking: finishWaiting,
    onPause: finishWaiting,
    onEnded: finishWaiting,
    onError: () => { finishWaiting(); playbackMetric(kind, 'error', 0, interruptions.current); },
  };
}
