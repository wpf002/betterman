'use client';

import { useEffect, useRef } from 'react';
import { recordProgress } from '@/lib/reading/actions';

/**
 * Records how far through a piece the reader got.
 *
 * Throttled and coalesced: scroll fires constantly, and a write per event
 * would be a request per frame. Only meaningful forward movement is sent, and
 * the last position is flushed when the page is hidden — which on mobile is
 * usually the only "leaving" event that fires at all.
 */
const STEP = 0.1;
const INTERVAL_MS = 4000;

export function ProgressTracker({ itemId, initialPercent }: { itemId: string; initialPercent: number }) {
  const sent = useRef(initialPercent);
  const pending = useRef(initialPercent);

  useEffect(() => {
    const measure = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const percent = scrollable <= 0 ? 1 : window.scrollY / scrollable;
      pending.current = Math.max(pending.current, Math.min(1, percent));
    };

    const flush = () => {
      if (pending.current - sent.current < STEP && pending.current < 1) return;
      if (pending.current <= sent.current) return;
      sent.current = pending.current;
      void recordProgress(itemId, pending.current).catch(() => undefined);
    };

    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      if (pending.current <= sent.current) return;
      sent.current = pending.current;
      void recordProgress(itemId, pending.current).catch(() => undefined);
    };

    measure();
    window.addEventListener('scroll', measure, { passive: true });
    document.addEventListener('visibilitychange', onHide);
    const timer = window.setInterval(flush, INTERVAL_MS);

    return () => {
      window.removeEventListener('scroll', measure);
      document.removeEventListener('visibilitychange', onHide);
      window.clearInterval(timer);
      flush();
    };
  }, [itemId]);

  return null;
}
