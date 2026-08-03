import Link from 'next/link';
import type { ArchiveEntry } from '@/lib/queries';
import type { Publication } from '@/lib/publications';
import { formatDevotionalDate, formatShortDate, toISODate } from '@/lib/dates';

/**
 * An archive list, in BetterMan chrome — hairline rules and whitespace, never
 * shadowed cards (spec §4). A source skin never appears here; skins live only
 * inside the 600px reading panel.
 */
export function ArchiveList({
  publication,
  entries,
}: {
  publication: Publication;
  entries: ArchiveEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="max-w-measure py-10 text-mute">
        Nothing here yet. New articles appear as soon as they are published.
      </p>
    );
  }

  const isDevotional = publication.slug === 'bettermornings';

  return (
    <ul className="border-t border-hair">
      {entries.map((entry) => {
        const dateLabel = isDevotional
          ? formatDevotionalDate(entry.slug)
          : formatShortDate(entry.publishedAt);
        // A devotional's secondary line is its passage; an article's is its subtitle.
        const secondary = isDevotional ? entry.scriptureRef : entry.subtitle;

        return (
          <li key={entry.id} className="border-b border-hair">
            <Link
              href={`/${publication.slug}/${entry.slug}`}
              className="group -mx-4 block rounded-sm px-4 py-6 transition-colors hover:bg-paper/70 active:bg-paper sm:-mx-5 sm:px-5"
            >
              <time
                dateTime={isDevotional ? entry.slug : toISODate(entry.publishedAt)}
                className="bm-eyebrow"
              >
                {dateLabel}
              </time>
              <h2 className="mt-2 text-[22px] font-normal leading-tight group-hover:text-clay-deep sm:text-[26px]">
                {entry.title}
              </h2>
              {secondary ? (
                <p className="mt-1.5 max-w-measure text-[15px] text-mute">{secondary}</p>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
