import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';
import { getReviewQueue } from '@/lib/admin/queries';
import { ReviewActions } from '../../_components/review-actions';

export const metadata = { title: 'Review queue' };
export const dynamic = 'force-dynamic';

/**
 * The parse review queue: everything ingest held back because it could not
 * trust its own reading of it (spec §9). Nothing here is visible to readers.
 */
export default async function ReviewQueuePage() {
  await requireAdmin();
  const queue = await getReviewQueue();

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <nav className="mb-8">
        <Link href="/admin" className="bm-eyebrow hover:text-ink">
          ← Ingest health
        </Link>
      </nav>

      <p className="bm-eyebrow">Review</p>
      <h1 className="mt-4 text-display-sm sm:text-display-md">
        {queue.length === 0 ? 'Nothing held' : `${queue.length} held back`}
      </h1>
      <p className="mt-4 max-w-measure text-mute">
        Ingest holds a piece when it cannot trust its own reading of it — usually because the
        template moved. Fix the parser and re-run, or publish it if the reading is fine.
      </p>

      {queue.length === 0 ? (
        <p className="mt-10 max-w-measure text-mute">
          Every ingested piece parsed cleanly. Nothing is waiting on you.
        </p>
      ) : (
        <ul className="mt-10 border-t border-hair">
          {queue.map((entry) => (
            <li key={entry.id} className="border-b border-hair py-8">
              <p className="bm-eyebrow">
                {entry.publication} · {entry.dateLabel}
                {entry.parseQuality !== null
                  ? ` · quality ${entry.parseQuality.toFixed(3)}`
                  : ''}
                {entry.templateEra ? ` · template ${entry.templateEra}` : ''}
              </p>

              <h2 className="mt-2 text-[24px]">{entry.title}</h2>

              {entry.unmatched.length > 0 ? (
                <p className="mt-3 max-w-measure text-[15px]">
                  <span className="font-bold">Unrecognized labels:</span>{' '}
                  {entry.unmatched.join(', ')} — the template may have changed.
                </p>
              ) : null}

              {entry.missing.length > 0 ? (
                <p className="mt-2 max-w-measure text-[15px] text-mute">
                  Missing: {entry.missing.join(', ')}
                </p>
              ) : null}

              <div className="mt-5">
                <ReviewActions itemId={entry.id} href={entry.href} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
