import Link from 'next/link';
import { PUBLICATIONS } from '@/lib/publications';
import { getLatestByPublication } from '@/lib/queries';
import { formatDevotionalDate, formatShortDate } from '@/lib/dates';

/**
 * Home is a CHOOSER, not a feed — three publications, each showing its latest
 * piece. There is deliberately no merged chronological river (spec §2).
 */
export const revalidate = 60;

export default async function HomePage() {
  const latest = await getLatestByPublication(PUBLICATIONS);

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <p className="bm-eyebrow">Read</p>
      <h1 className="mt-4 text-display-sm sm:text-display-md">
        Three publications, <em className="bm-emphasis">one place</em>.
      </h1>

      <ul className="mt-12 border-t border-hair sm:mt-16">
        {PUBLICATIONS.map((pub) => {
          const entry = latest.get(pub.slug) ?? null;
          const dateLabel = entry
            ? pub.slug === 'bettermornings'
              ? formatDevotionalDate(entry.slug)
              : formatShortDate(entry.publishedAt)
            : null;

          return (
            <li key={pub.slug} className="border-b border-hair">
              <Link
                href={`/${pub.slug}`}
                className="group block py-8 transition-colors hover:bg-paper/60 sm:py-10"
              >
                <p className="bm-eyebrow">{pub.cadence}</p>
                <h2 className="mt-2 text-display-sm group-hover:text-clay-deep">{pub.name}</h2>

                {entry ? (
                  <p className="mt-4 max-w-measure text-mute">
                    <span className="text-ink">{entry.title}</span>
                    {dateLabel ? <span className="whitespace-nowrap"> · {dateLabel}</span> : null}
                  </p>
                ) : (
                  <p className="mt-4 max-w-measure text-mute">{pub.blurb}</p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
