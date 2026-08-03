import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SKIN_CLASS } from '@betterman/ui';
import { BettermorningsPanel } from '../../_components/skins/bettermornings-panel';
import { SubstackPanel } from '../../_components/skins/substack-panel';
import { getPublication } from '@/lib/publications';
import { getItem, getNeighbours } from '@/lib/queries';
import { formatDevotionalDate, formatLongDate } from '@/lib/dates';

/**
 * A reading page: BetterMan chrome above, a centred 600px source panel below
 * (spec §3). The chrome is identical for all three publications; only the
 * panel changes.
 */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publication: string; slug: string }>;
}): Promise<Metadata> {
  const { publication, slug } = await params;
  const pub = getPublication(publication);
  if (!pub) return {};
  const item = await getItem(pub, slug);
  if (!item) return {};

  return {
    title: `${item.title} · ${pub.name}`,
    description: item.subtitle ?? undefined,
  };
}

export default async function ReadingPage({
  params,
}: {
  params: Promise<{ publication: string; slug: string }>;
}) {
  const { publication, slug } = await params;
  const pub = getPublication(publication);
  if (!pub) notFound();

  const item = await getItem(pub, slug);
  if (!item) notFound();

  const { older, newer } = await getNeighbours(pub, item.publishedAt);

  const isDevotional = pub.slug === 'bettermornings';
  const dateLabel = isDevotional
    ? formatDevotionalDate(item.slug)
    : formatLongDate(item.publishedAt);

  return (
    <div className="px-4 py-8 sm:py-12">
      {/* Chrome: where you are, and the way back to the archive. */}
      <nav className="mx-auto mb-8 max-w-panel">
        <Link href={`/${pub.slug}`} className="bm-eyebrow hover:text-ink">
          ← {pub.name}
        </Link>
      </nav>

      {isDevotional ? (
        <BettermorningsPanel item={item} />
      ) : (
        <SubstackPanel item={item} publication={pub} skinClass={SKIN_CLASS[pub.slug]} />
      )}

      {/* Chrome again below the panel — BetterMan styling, no skin values. */}
      <footer className="mx-auto mt-10 max-w-panel border-t border-hair pt-6">
        <p className="bm-eyebrow">{dateLabel}</p>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:justify-between">
          {newer ? (
            <Link href={`/${pub.slug}/${newer.slug}`} className="group max-w-[45ch]">
              <span className="bm-eyebrow">Newer</span>
              <span className="mt-1 block text-[17px] group-hover:text-clay-deep">
                {newer.title}
              </span>
            </Link>
          ) : (
            <span />
          )}

          {older ? (
            <Link href={`/${pub.slug}/${older.slug}`} className="group max-w-[45ch] sm:text-right">
              <span className="bm-eyebrow">Older</span>
              <span className="mt-1 block text-[17px] group-hover:text-clay-deep">
                {older.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </div>
      </footer>
    </div>
  );
}
