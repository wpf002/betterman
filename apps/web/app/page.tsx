import Link from 'next/link';
import { PUBLICATIONS } from '@/lib/publications';
import { getLatestByPublication } from '@/lib/queries';
import { formatDevotionalDate, formatShortDate } from '@/lib/dates';

/**
 * Home is a CHOOSER, not a feed — three publications, each showing its latest
 * piece. There is deliberately no merged chronological river (spec §2).
 *
 * The hero mirrors betterman.com: the line centred and set large, the
 * subhead beneath it, then the three convictions in a row with their check
 * marks. All of it is BetterMan's own copy, not invented here.
 */
export const dynamic = 'force-dynamic';

const CONVICTIONS = [
  ['Clarity', "God's timeless definition. Ancient paths are the best paths."],
  ['Community', 'Every man everywhere. No man left behind.'],
  ['Transformation', 'When men are better, everything changes.'],
] as const;

function CheckMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-6 w-6 text-ink sm:h-7 sm:w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
    >
      <circle cx="12" cy="12" r="9.25" />
      <path d="M7.75 12.4l2.9 2.9 5.6-6.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function HomePage() {
  const latest = await getLatestByPublication(PUBLICATIONS);

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-20">
      <section className="text-center">
        <h1 className="mx-auto max-w-[20ch] text-display-md sm:max-w-none sm:text-display-lg">
          We believe men deserve <em className="bm-emphasis">better</em>.
        </h1>
        <p className="mx-auto mt-6 max-w-[52ch] text-mute">
          Biblically rich, theologically sound, and incredibly practical. We know having a clear
          vision of manhood changes everything.
        </p>

        {/*
          Two shapes. On a phone: compact left-aligned rows, mark beside the
          text — the website's centred stack becomes three tall, ragged blocks
          at 375px and eats the whole screen before a reader reaches anything
          to read. From `sm` up there is room for the site's own arrangement.
        */}
        <ul className="mt-10 space-y-5 text-left sm:mt-12 sm:grid sm:grid-cols-3 sm:gap-8 sm:space-y-0 sm:text-center">
          {CONVICTIONS.map(([name, line]) => (
            <li key={name} className="flex gap-3 sm:mx-auto sm:max-w-[34ch] sm:flex-col sm:gap-0">
              <span className="mt-0.5 shrink-0 sm:mx-auto sm:mb-4 sm:mt-0 sm:flex sm:justify-center">
                <CheckMark />
              </span>
              <p className="text-[16px] leading-relaxed sm:text-[17px]">
                <span className="bm-emphasis font-bold">{name}:</span> {line}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <ul className="mt-16 border-t border-hair sm:mt-24">
        {PUBLICATIONS.map((pub) => {
          const entry = latest.get(pub.slug) ?? null;
          const dateLabel = entry
            ? pub.slug === 'bettermornings'
              ? formatDevotionalDate(entry.slug)
              : formatShortDate(entry.publishedAt)
            : null;

          return (
            <li key={pub.slug} className="border-b border-hair">
              {/* The negative margin lets the tap highlight reach the page
                  gutter rather than hugging the words. */}
              <Link
                href={`/${pub.slug}`}
                className="group -mx-4 block rounded-sm px-4 py-7 transition-colors hover:bg-paper/70 active:bg-paper sm:-mx-5 sm:px-5 sm:py-9"
              >
                <h2 className="text-display-sm group-hover:text-clay-deep">{pub.name}</h2>

                {entry ? (
                  <p className="mt-3 max-w-measure text-mute">
                    <span className="text-ink">{entry.title}</span>
                    {dateLabel ? <span className="whitespace-nowrap"> · {dateLabel}</span> : null}
                  </p>
                ) : (
                  <p className="mt-3 max-w-measure text-mute">{pub.blurb}</p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
