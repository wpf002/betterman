import Link from 'next/link';

/**
 * Home is a CHOOSER, not a feed. Exactly three publications, never merged
 * into one chronological river (spec §2).
 *
 * Phase 2 replaces the static copy below with each publication's latest piece.
 */
const PUBLICATIONS = [
  {
    slug: 'bettermornings',
    name: 'BetterMornings',
    cadence: 'Weekday mornings',
    blurb: 'The daily devotional from BetterMan.',
  },
  {
    slug: 'good-trouble',
    name: 'Good Trouble',
    cadence: 'About twice a week',
    blurb: 'Chris Harper on the church, culture and courage.',
  },
  {
    slug: 'josiah-jones',
    name: 'Josiah Jones',
    cadence: 'Irregular',
    blurb: 'Essays from Josiah Jones.',
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <p className="bm-eyebrow">Read</p>
      <h1 className="mt-4 text-display-sm sm:text-display-md">
        Three publications, <em className="bm-emphasis">one place</em>.
      </h1>

      <ul className="mt-12 border-t border-hair">
        {PUBLICATIONS.map((pub) => (
          <li key={pub.slug} className="border-b border-hair">
            <Link
              href={`/${pub.slug}`}
              className="group block py-8 transition-colors hover:bg-paper/60"
            >
              <p className="bm-eyebrow">{pub.cadence}</p>
              <h2 className="mt-2 text-display-sm group-hover:text-clay-deep">{pub.name}</h2>
              <p className="mt-2 max-w-measure text-mute">{pub.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
