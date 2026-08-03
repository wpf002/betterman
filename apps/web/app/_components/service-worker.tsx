'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production only.
 *
 * In dev it stays off deliberately: a worker caching pages while you edit them
 * is a debugging trap, and it was already the cause of one confusing stale
 * render during Phase 2.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // Refresh the offline set whenever the app is opened, so a reader who
        // installs today and opens next week still has the recent 30 days.
        registration.active?.postMessage('precache-recent');
      } catch {
        // A failed registration must never break reading.
      }
    };

    // Registration competes with the first paint for bandwidth; wait it out.
    if (document.readyState === 'complete') void register();
    else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
