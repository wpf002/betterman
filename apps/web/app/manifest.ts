import type { MetadataRoute } from 'next';
import { chrome } from '@betterman/ui';

/**
 * PWA manifest. Icons are generated from the BetterMan mark — see
 * `scripts/generate-icons.mjs`.
 *
 * `display: standalone` matters beyond appearance: on iOS, Web Push only works
 * once the app has been added to the home screen (spec §10), and that requires
 * the app to run standalone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BetterMan Reader',
    short_name: 'BetterMan',
    description:
      'BetterMornings, Good Trouble and Josiah Jones — three publications, one place to read them.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: chrome.bone,
    theme_color: chrome.bone,
    categories: ['books', 'lifestyle', 'news'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'BetterMornings', url: '/bettermornings' },
      { name: 'Good Trouble', url: '/good-trouble' },
      { name: 'Josiah Jones', url: '/josiah-jones' },
    ],
  };
}
