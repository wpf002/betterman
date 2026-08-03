'use client';

import { useEffect, useState, useTransition } from 'react';
import type { SourceKey } from '@betterman/db';
import {
  registerDevice,
  setDeliveryHour,
  setPublicationPref,
  unregisterDevice,
} from '@/lib/notifications/actions';

/**
 * Notification toggles, one per publication (spec §10).
 *
 * The browser permission prompt is only raised when a reader actually turns
 * something on — asking on page load is how people end up blocking
 * notifications permanently.
 */

interface Publication {
  slug: string;
  key: string;
  name: string;
}

type Permission = 'default' | 'granted' | 'denied' | 'unsupported';

/** VAPID public keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function NotificationSettings({
  publications,
  initialPrefs,
  initialHour,
  initialDeviceCount,
  vapidPublicKey,
}: {
  publications: Publication[];
  initialPrefs: Record<string, boolean>;
  initialHour: number;
  initialDeviceCount: number;
  vapidPublicKey: string;
}) {
  const [permission, setPermission] = useState<Permission>('default');
  const [prefs, setPrefs] = useState(initialPrefs);
  const [hour, setHour] = useState(initialHour);
  const [devices, setDevices] = useState(initialDeviceCount);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as Permission);
  }, []);

  /** Registers this device, raising the permission prompt if needed. */
  async function ensureDevice(): Promise<boolean> {
    if (permission === 'unsupported') return false;
    if (!vapidPublicKey) {
      setError('Notifications are not configured on this server yet.');
      return false;
    }

    const granted =
      Notification.permission === 'granted'
        ? 'granted'
        : ((await Notification.requestPermission()) as Permission);

    setPermission(granted);
    if (granted !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));

    const json = subscription.toJSON();
    if (!json.keys?.p256dh || !json.keys?.auth) return false;

    const result = await registerDevice({
      endpoint: subscription.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    if (result.ok) setDevices((n) => Math.max(n, 1));
    return result.ok;
  }

  async function toggle(key: string, next: boolean) {
    setError(null);

    if (next && !(await ensureDevice())) {
      if (Notification.permission === 'denied') {
        setError('Your browser is blocking notifications for this site. Allow them, then try again.');
      }
      return;
    }

    setPrefs((prev) => ({ ...prev, [key]: next }));
    startTransition(() => {
      void setPublicationPref(key as SourceKey, next);
    });
  }

  const anyOn = Object.values(prefs).some(Boolean);

  if (permission === 'unsupported') {
    return (
      <p className="mt-8 max-w-measure text-[15px] text-mute">
        This browser doesn&rsquo;t support notifications. On iPhone, add BetterMan Reader to your
        home screen first — Safari only allows them for installed apps.
      </p>
    );
  }

  return (
    <>
      <ul className="mt-10 border-t border-hair sm:mt-12">
        {publications.map((pub) => {
          const on = Boolean(prefs[pub.key]);
          return (
            <li
              key={pub.slug}
              className="flex items-center justify-between gap-6 border-b border-hair py-6"
            >
              <h2 className="text-[20px] font-normal leading-tight">{pub.name}</h2>

              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Notify me about ${pub.name}`}
                onClick={() => void toggle(pub.key, !on)}
                className={`relative h-7 w-12 shrink-0 rounded-pill border transition-colors ${
                  on ? 'border-clay bg-clay' : 'border-hair bg-paper'
                }`}
              >
                <span
                  className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all ${
                    on ? 'left-6 bg-white' : 'left-0.5 bg-hair'
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {prefs.BETTERMORNINGS ? (
        <div className="mt-8">
          <label className="block max-w-measure">
            <span className="bm-eyebrow">Deliver BetterMornings at</span>
            <select
              value={hour}
              onChange={(e) => {
                const next = Number(e.target.value);
                setHour(next);
                startTransition(() => {
                  void setDeliveryHour(next);
                });
              }}
              className="mt-2 w-full border border-hair bg-paper px-4 py-3 text-[17px] focus:border-clay focus:outline-none"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-[15px] text-mute">
              Your local time. If a devotional lands after this hour, it arrives straight away
              rather than waiting for tomorrow.
            </span>
          </label>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 max-w-measure border-l-2 border-clay pl-4 text-[15px]">
          {error}
        </p>
      ) : null}

      {anyOn && devices > 0 ? (
        <p className="mt-6 max-w-measure text-[15px] text-mute">
          This device is registered. Turning a publication off here turns it off everywhere.{' '}
          <button
            type="button"
            className="underline hover:text-ink"
            onClick={async () => {
              const registration = await navigator.serviceWorker.ready;
              const sub = await registration.pushManager.getSubscription();
              if (sub) {
                await unregisterDevice(sub.endpoint);
                await sub.unsubscribe();
                setDevices(0);
              }
            }}
          >
            Stop notifications on this device
          </button>
          .
        </p>
      ) : null}
    </>
  );
}
