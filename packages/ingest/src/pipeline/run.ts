/**
 * Ingest orchestration. One IngestRun row per invocation, so Phase 8's health
 * dashboard has something to read and a failed run is visible rather than
 * silent.
 */
import { IngestStatus, SourceKind, prisma, type Source } from '@betterman/db';
import {
  fetchArchive,
  fetchPostBody,
  hasSubstackSession,
  sleep,
  RATE_LIMIT_MS,
} from '../substack/archive.js';
import {
  MIN_BODY_CHARS,
  hasReadableArticle,
  isReadableArticle,
  normalizeSubstackPost,
  scriptureRefsForArticle,
} from '../substack/normalize.js';
import { storeRawPayload, upsertItem } from './upsert.js';

export interface RunCounters {
  seen: number;
  created: number;
  updated: number;
  skipped: number;
  inReview: number;
}

const emptyCounters = (): RunCounters => ({
  seen: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  inReview: 0,
});

export async function startRun(sourceId: string | null, trigger: string) {
  return prisma.ingestRun.create({
    data: { sourceId, trigger, status: IngestStatus.RUNNING },
    select: { id: true },
  });
}

export async function finishRun(
  runId: string,
  counters: RunCounters,
  status: IngestStatus,
  error?: string,
) {
  await prisma.ingestRun.update({
    where: { id: runId },
    data: {
      status,
      finishedAt: new Date(),
      itemsSeen: counters.seen,
      itemsCreated: counters.created,
      itemsUpdated: counters.updated,
      itemsSkipped: counters.skipped,
      itemsInReview: counters.inReview,
      error: error ?? null,
    },
  });
}

export interface SubstackRunOptions {
  /** Cap the number of posts fetched. Omit to take the whole archive. */
  limit?: number;
  /** Skip posts already stored with a matching hash without refetching. */
  incremental?: boolean;
  log?: (message: string) => void;
}

/**
 * Backfills or refreshes one Substack publication.
 *
 * Body fetches are the expensive part (one page load each, rate limited), so
 * in incremental mode we skip any post we already have before fetching it.
 */
export async function ingestSubstackSource(
  source: Source,
  opts: SubstackRunOptions = {},
): Promise<RunCounters> {
  const log = opts.log ?? (() => {});
  const host = source.apiHost;
  if (!host) throw new Error(`Source ${source.key} has no apiHost`);

  const counters = emptyCounters();
  const run = await startRun(source.id, opts.incremental ? 'rss' : 'archive-backfill');

  try {
    const archive = await fetchArchive(host, {
      onPage: (count, total) => log(`  ${host}: +${count} (${total} listed)`),
    });

    const subscribed = hasSubstackSession();
    if (subscribed) log('  using the configured Substack session for paid posts');

    const readable = archive.filter((entry) => isReadableArticle(entry, subscribed));
    const targets = opts.limit ? readable.slice(0, opts.limit) : readable;
    counters.skipped += archive.length - readable.length;

    const known = new Map(
      (
        await prisma.item.findMany({
          where: { sourceId: source.id },
          select: { externalId: true, contentHash: true },
        })
      ).map((row) => [row.externalId, row.contentHash]),
    );

    for (const entry of targets) {
      counters.seen += 1;

      if (opts.incremental && known.has(String(entry.id))) {
        counters.skipped += 1;
        continue;
      }

      const bodyHtml = await fetchPostBody(host, entry.slug);
      await sleep(RATE_LIMIT_MS);

      if (!bodyHtml || bodyHtml.length < MIN_BODY_CHARS) {
        // A paid post this short means the session is missing or expired —
        // storing it would put a paywall stub in the library.
        const why =
          entry.audience !== 'everyone' && !subscribed
            ? 'paywalled, no session configured'
            : entry.audience !== 'everyone'
              ? 'paywalled, session did not unlock it'
              : 'no usable body';
        log(`  ! ${entry.slug} — skipped (${why})`);
        counters.skipped += 1;
        continue;
      }

      await storeRawPayload({
        sourceId: source.id,
        runId: run.id,
        kind: 'substack-post-json',
        externalId: String(entry.id),
        body: bodyHtml,
      });

      const normalized = normalizeSubstackPost(entry, bodyHtml, host);

      // Checked after sanitizing, not before: a live-video announcement has
      // plenty of markup and almost no words.
      if (!hasReadableArticle(normalized)) {
        log(`  ! ${entry.slug} — skipped (no article, ${normalized.contentText.length} chars)`);
        counters.skipped += 1;
        continue;
      }

      const result = await upsertItem(source, normalized, {
        scriptureRefs: scriptureRefsForArticle(normalized),
      });
      if (result.outcome === 'created') counters.created += 1;
      else if (result.outcome === 'updated') counters.updated += 1;
      else counters.skipped += 1;
    }

    await finishRun(run.id, counters, IngestStatus.SUCCESS);
    return counters;
  } catch (err) {
    await finishRun(run.id, counters, IngestStatus.FAILED, String(err));
    throw err;
  }
}

/** Runs every active Substack publication. */
export async function ingestAllSubstack(opts: SubstackRunOptions = {}): Promise<RunCounters> {
  const sources = await prisma.source.findMany({
    where: { kind: SourceKind.SUBSTACK, active: true },
    orderBy: { key: 'asc' },
  });

  const totals = emptyCounters();
  for (const source of sources) {
    opts.log?.(`${source.name} (${source.apiHost})`);
    const counters = await ingestSubstackSource(source, opts);
    totals.seen += counters.seen;
    totals.created += counters.created;
    totals.updated += counters.updated;
    totals.skipped += counters.skipped;
    totals.inReview += counters.inReview;
  }
  return totals;
}
