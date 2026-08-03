import Link from 'next/link';

/**
 * Shown when a navigation fails and the page is not in the cache. Precached by
 * the service worker on install, so it is always available offline.
 */
export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-shell px-5 py-16 sm:py-24">
      <p className="bm-eyebrow">Offline</p>
      <h1 className="mt-4 max-w-measure text-display-sm sm:text-display-md">
        You&rsquo;re offline, but your <em className="bm-emphasis">recent reading</em> is here.
      </h1>
      <p className="mt-4 max-w-measure text-mute">
        Anything from the last 30 days was saved to this device. Anything newer will appear when
        you&rsquo;re back online.
      </p>

      <ul className="mt-10 border-t border-hair">
        {[
          { slug: 'bettermornings', name: 'BetterMornings' },
          { slug: 'good-trouble', name: 'Good Trouble' },
          { slug: 'josiah-jones', name: 'Josiah Jones' },
        ].map((pub) => (
          <li key={pub.slug} className="border-b border-hair">
            <Link href={`/${pub.slug}`} className="block py-5 text-[20px] hover:text-clay-deep">
              {pub.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
