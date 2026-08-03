'use client';

import { useEffect, useState } from 'react';

/**
 * iOS constraint, surfaced in the UI per spec §10: web push works only on
 * iOS 16.4+, and only once the PWA has been added to the home screen. Shown
 * to iOS Safari users who have not installed yet, so the toggles below are not
 * offered against a promise the browser cannot keep.
 */
export function IosInstallNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // Safari's own flag, which is not part of the standard Navigator type.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setShow(isIos && !isStandalone);
  }, []);

  if (!show) return null;

  return (
    <div className="mt-8 border-l-2 border-clay bg-paper/70 px-5 py-4">
      <p className="bm-eyebrow">On iPhone</p>
      <p className="mt-2 max-w-measure text-[15px]">
        Notifications need BetterMan Reader on your home screen first. Tap{' '}
        <em className="bm-emphasis">Share</em>, then{' '}
        <em className="bm-emphasis">Add to Home Screen</em>, and open it from there.
      </p>
    </div>
  );
}
