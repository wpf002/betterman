import Link from 'next/link';
import { IngestStatus } from '@betterman/db';
import { requireAdmin } from '@/lib/admin/guard';
import { getRecentRuns, getSourceHealth } from '@/lib/admin/queries';
import { getReviewQueue } from '@/lib/admin/queries';
import { formatLongDate } from '@/lib/dates';

export const metadata = { title: 'Ingest health' };
export const dynamic = 'force-dynamic';

const relative = (at: Date | null) => {
  if (!at) return 'never';
  const mins = Math.round((Date.now() - at.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export default async function AdminPage() {
  await requireAdmin();

  const [health, runs, queue] = await Promise.all([
    getSourceHealth(),
    getRecentRuns(),
    getReviewQueue(),
  ]);

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <p className="bm-eyebrow">Admin</p>
      <h1 className="mt-4 text-display-sm sm:text-display-md">Ingest health</h1>

      {queue.length > 0 ? (
        <Link
          href="/admin/review"
          className="mt-8 block border-l-2 border-clay bg-paper/70 px-5 py-4 hover:bg-paper"
        >
          <p className="bm-eyebrow">Needs a look</p>
          <p className="mt-2 text-[17px]">
            {queue.length} {queue.length === 1 ? 'piece is' : 'pieces are'} held for review →
          </p>
        </Link>
      ) : (
        <p className="mt-8 max-w-measure text-mute">Nothing is held for review.</p>
      )}

      <section className="mt-14">
        <h2 className="bm-eyebrow">By publication</h2>
        <ul className="mt-4 border-t border-hair">
          {health.map((source) => (
            <li key={source.slug} className="border-b border-hair py-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="text-[22px]">{source.name}</h3>
                <span className="bm-eyebrow">
                  {source.published} published
                  {source.inReview > 0 ? ` · ${source.inReview} held` : ''}
                </span>
              </div>
              <p className="mt-2 text-[15px] text-mute">
                Newest piece{' '}
                {source.latestPublishedAt ? formatLongDate(source.latestPublishedAt) : '—'} · last
                run {relative(source.lastRunAt)}
                {source.lastRunStatus ? ` (${source.lastRunStatus.toLowerCase()})` : ''}
              </p>
              {source.lastRunError ? (
                <p className="mt-2 max-w-measure border-l-2 border-clay pl-3 text-[15px]">
                  {source.lastRunError.slice(0, 300)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="bm-eyebrow">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="mt-4 text-mute">No ingest runs recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-[15px]">
              <thead>
                <tr className="border-y border-hair text-left">
                  <th className="bm-eyebrow py-3 pr-4 font-bold">When</th>
                  <th className="bm-eyebrow py-3 pr-4 font-bold">Source</th>
                  <th className="bm-eyebrow py-3 pr-4 font-bold">Trigger</th>
                  <th className="bm-eyebrow py-3 pr-4 font-bold">Result</th>
                  <th className="bm-eyebrow py-3 font-bold">Items</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-hair align-top">
                    <td className="py-3 pr-4 text-mute">{relative(run.startedAt)}</td>
                    <td className="py-3 pr-4">{run.source?.name ?? '—'}</td>
                    <td className="py-3 pr-4 text-mute">{run.trigger}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          run.status === IngestStatus.FAILED ? 'font-bold text-clay-deep' : ''
                        }
                      >
                        {run.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="py-3 text-mute">
                      {run.itemsCreated > 0 ? `+${run.itemsCreated} new ` : ''}
                      {run.itemsUpdated > 0 ? `${run.itemsUpdated} updated ` : ''}
                      {run.itemsInReview > 0 ? `${run.itemsInReview} held ` : ''}
                      {run.itemsCreated + run.itemsUpdated + run.itemsInReview === 0
                        ? `${run.itemsSeen} seen, nothing changed`
                        : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
