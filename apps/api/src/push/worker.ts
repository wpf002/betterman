import { prisma } from '@betterman/db';
import { localDate, safeTimeZone } from '@betterman/ingest';
import { configurePush, sendToSubscription, type PushPayload } from './send.js';

/**
 * Drains the pending-notification queue.
 *
 * Ingest decides *whether* a reader is owed a notification; this decides
 * whether it may go out yet, and enforces the once-per-publication-per-day
 * debounce (spec §10).
 *
 * Polling is 30s so delivery lands well inside the five-minute bound the phase
 * is measured against, while a reader's chosen morning hour is still honoured
 * to the minute.
 */

const POLL_MS = 30_000;
const BATCH = 100;

export interface DrainResult {
  considered: number;
  sent: number;
  debounced: number;
  noDevice: number;
  failed: number;
}

export async function drainQueue(now = new Date()): Promise<DrainResult> {
  const result: DrainResult = { considered: 0, sent: 0, debounced: 0, noDevice: 0, failed: 0 };
  if (!configurePush()) return result;

  const due = await prisma.pendingNotification.findMany({
    where: { sentAt: null, skippedReason: null, deliverAfter: { lte: now } },
    orderBy: { deliverAfter: 'asc' },
    take: BATCH,
    select: {
      id: true,
      userId: true,
      sourceId: true,
      user: { select: { timezone: true, subscriptions: true } },
      source: { select: { name: true, slug: true } },
      item: { select: { title: true, slug: true } },
    },
  });

  for (const row of due) {
    result.considered += 1;

    const zone = safeTimeZone(row.user.timezone);
    const today = localDate(now, zone);

    // Debounce by claiming the day first. The unique (userId, sourceId,
    // localDate) makes this atomic, so two workers cannot both send.
    // `skipDuplicates` reports the collision instead of throwing, which keeps
    // an entirely expected condition out of the error log.
    const claim = await prisma.pushLog.createMany({
      data: [{ userId: row.userId, sourceId: row.sourceId, localDate: today }],
      skipDuplicates: true,
    });

    if (claim.count === 0) {
      await prisma.pendingNotification.update({
        where: { id: row.id },
        data: { skippedReason: 'debounced: already notified for this publication today' },
      });
      result.debounced += 1;
      continue;
    }

    if (row.user.subscriptions.length === 0) {
      await prisma.pendingNotification.update({
        where: { id: row.id },
        data: { skippedReason: 'no registered device' },
      });
      result.noDevice += 1;
      continue;
    }

    const payload: PushPayload = {
      // Publication name plus headline, per spec §10.
      title: row.source.name,
      body: row.item.title,
      url: `/${row.source.slug}/${row.item.slug}`,
      tag: `${row.source.slug}-${row.item.slug}`,
    };

    const outcomes = await Promise.all(
      row.user.subscriptions.map((sub) => sendToSubscription(sub, payload)),
    );

    const delivered = outcomes.some((o) => o === 'sent');

    await prisma.pendingNotification.update({
      where: { id: row.id },
      data: delivered
        ? { sentAt: new Date() }
        : { skippedReason: `no device accepted delivery (${outcomes.join(', ') || 'none'})` },
    });

    if (delivered) result.sent += 1;
    else result.failed += 1;
  }

  return result;
}

/** Starts the poll loop. Returns a stop function for graceful shutdown. */
export function startPushWorker(log: {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}): () => void {
  if (!configurePush()) {
    log.info({}, 'push worker idle — VAPID keys not configured');
    return () => undefined;
  }

  let running = false;

  const tick = async () => {
    if (running) return; // A slow batch must not overlap the next tick.
    running = true;
    try {
      const result = await drainQueue();
      if (result.considered > 0) log.info(result, 'push queue drained');
    } catch (err) {
      log.error({ err }, 'push queue drain failed');
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void tick(), POLL_MS);
  void tick();

  return () => clearInterval(timer);
}
