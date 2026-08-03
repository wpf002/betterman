/* eslint-env serviceworker */
/**
 * BetterMan Reader service worker.
 *
 * Hand-written rather than generated, because the caching rules here are
 * specific to the app: reading pages are worth keeping, the archive lists are
 * worth refreshing, and the last 30 days must survive going offline (spec §12).
 *
 * Strategies, by request kind:
 *   - navigations        network-first, falling back to cache, then /offline
 *   - /_next/static/*    cache-first (content-hashed, immutable)
 *   - fonts & images     cache-first with a cap
 *   - /offline-manifest  network-only (it decides what to precache)
 *
 * Bump CACHE_VERSION to retire every old cache at once.
 */

const CACHE_VERSION = 'v3';
const SHELL_CACHE = `betterman-shell-${CACHE_VERSION}`;
const PAGES_CACHE = `betterman-pages-${CACHE_VERSION}`;
const ASSETS_CACHE = `betterman-assets-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline';

/** Always available, even on a cold offline start. */
const SHELL_URLS = [OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png'];

/** Keep the asset cache from growing without bound on a long-lived install. */
const MAX_ASSETS = 160;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one 404 cannot fail the whole install.
      await Promise.all(
        SHELL_URLS.map((url) => cache.add(url).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, PAGES_CACHE, ASSETS_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
      await precacheRecent();
    })(),
  );
});

/**
 * Asks the server which pieces count as "the last 30 days" and caches them.
 * Failure is not fatal — the app still works, it just has less available
 * offline.
 */
async function precacheRecent() {
  try {
    const res = await fetch('/offline-manifest', { cache: 'no-store' });
    if (!res.ok) return;

    const { urls } = await res.json();
    if (!Array.isArray(urls)) return;

    const cache = await caches.open(PAGES_CACHE);
    const assets = await caches.open(ASSETS_CACHE);
    const seenAssets = new Set();

    // Serial rather than parallel: a backfill can make this list long, and a
    // burst of 90 requests on a phone radio is worse than a slow trickle.
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) continue;

        const html = await response.clone().text();
        await cache.put(url, response.clone());

        // Caching the HTML alone is not enough: the page still needs its
        // JavaScript and CSS to hydrate, and without them an offline visit
        // renders a blank client-side error instead of the piece.
        await precacheSubresources(html, assets, seenAssets);
      } catch {
        // Offline mid-precache; whatever landed is still useful.
        break;
      }
    }
  } catch {
    /* no-op */
  }
}

/**
 * Caches the build assets a page references. Scans the HTML for /_next/static
 * URLs, then scans any stylesheet found for the fonts it pulls in — next/font
 * emits those as url() inside CSS, so an HTML-only scan would miss Spectral and
 * the Josiah Jones panel would fall back to Georgia offline.
 */
async function precacheSubresources(html, assets, seen) {
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) {
    if (match[1]) urls.add(match[1].replace(/&amp;/g, '&'));
  }

  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);

    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      if (url.endsWith('.css')) {
        const css = await response.clone().text();
        for (const fontMatch of css.matchAll(/url\((\/_next\/static\/media\/[^)"']+)\)/g)) {
          const fontUrl = fontMatch[1];
          if (!fontUrl || seen.has(fontUrl)) continue;
          seen.add(fontUrl);
          try {
            const font = await fetch(fontUrl);
            if (font.ok) await assets.put(fontUrl, font.clone());
          } catch {
            /* skip this font */
          }
        }
      }

      await assets.put(url, response.clone());
    } catch {
      /* skip this asset */
    }
  }
}

self.addEventListener('message', (event) => {
  if (event.data === 'precache-recent') event.waitUntil(precacheRecent());
  if (event.data === 'skip-waiting') self.skipWaiting();
});

/** Trims a cache to its most recent `max` entries. */
async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/')
  );
}

function isCacheableAsset(request, url) {
  return (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/_next/image')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never interfere with anything that changes server state.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only. Substack images and the HubSpot CDN are left alone.
  if (url.origin !== self.location.origin) return;

  // The precache list must always be fresh.
  if (url.pathname === '/offline-manifest') return;

  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  /*
   * React Server Component payloads, which Next prefetches on hover and fetches
   * on every in-app link click. Network-first with a cached fallback, so
   * tapping through the archive offline resolves from cache instead of failing
   * the prefetch and forcing a full document reload.
   */
  if (url.searchParams.has('_rsc')) {
    event.respondWith(networkFirst(request, PAGES_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  if (isCacheableAsset(request, url)) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE, MAX_ASSETS));
  }
});

/**
 * Network-first so a reader online always sees the newest devotional, with the
 * cached copy as the safety net and /offline as the last resort.
 */
async function handleNavigation(request) {
  const cache = await caches.open(PAGES_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const shell = await caches.open(SHELL_CACHE);
    const offline = await shell.match(OFFLINE_URL);
    if (offline) return offline;

    return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
  }
}

/** Fresh when the network answers, cached when it does not. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Let Next fall back to a full document navigation, which the navigation
    // handler above serves from cache.
    return new Response('', { status: 504 });
  }
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      if (max) await trimCache(cacheName, max);
    }
    return response;
  } catch {
    return cached ?? Response.error();
  }
}
