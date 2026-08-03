import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SKIN_CLASS } from '@betterman/ui';
import { BettermorningsPanel } from '../../_components/skins/bettermornings-panel';
import { SubstackPanel } from '../../_components/skins/substack-panel';
import { ReaderControls } from '../../_components/reader-controls';
import { ProgressTracker } from '../../_components/progress-tracker';
import { getPublication } from '@/lib/publications';
import { getItem, getNeighbours } from '@/lib/queries';
import { getSessionUser } from '@/lib/auth/session';
import { getReaderState } from '@/lib/reading/queries';
import { formatDevotionalDate, formatLongDate } from '@/lib/dates';

/**
 * A reading page: BetterMan chrome above, a centred 600px source panel below
 * (spec §3). The chrome is identical for all three publications; only the
 * panel changes.
 */
/**
 * Rendered per request rather than cached: the panel is the same for everyone,
 * but the bookmark state below it is not.
 */
export const dynamic = 'force-dynamic';

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

  const [{ older, newer }, user] = await Promise.all([
    getNeighbours(pub, item.publishedAt),
    getSessionUser(),
  ]);
  const readerState = await getReaderState(user?.id ?? null, item.id);
  const path = `/${pub.slug}/${item.slug}`;

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

        <div className="mt-6">
          <ReaderControls
            itemId={item.id}
            path={path}
            state={readerState}
            signedIn={Boolean(user)}
          />
        </div>

        <div className="mt-10 flex flex-col gap-6 border-t border-hair pt-6 sm:flex-row sm:justify-between">
          {newer ? (
            <Link href={`/${pub.slug}/${newer.slug}`} className="group max-w-[45ch]">
              <span className="bm-eyebrow">Next</span>
              <span className="mt-1 block text-[17px] group-hover:text-clay-deep">
                {newer.title}
              </span>
            </Link>
          ) : (
            <span />
          )}

          {older ? (
            <Link href={`/${pub.slug}/${older.slug}`} className="group max-w-[45ch] sm:text-right">
              <span className="bm-eyebrow">Previous</span>
              <span className="mt-1 block text-[17px] group-hover:text-clay-deep">
                {older.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </div>
      </footer>

      {user ? <ProgressTracker itemId={item.id} initialPercent={readerState.percent} /> : null}
    </div>
  );
}
