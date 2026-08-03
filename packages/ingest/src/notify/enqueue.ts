/**
 * Fan-out: turning one newly ingested piece into one notification per
 * subscribed reader.
 *
 * This runs from ingest itself, not from a timer, so a devotional that goes out
 * at an unusual hour still notifies correctly (spec §10). What the timer decides
 * is only *when* each row may be delivered — see `resolveDelivery`.
 */
import { ItemStatus, prisma } from '@betterman/db';
import { resolveDelivery, safeTimeZone } from './schedule.js';

export interface FanOutResult {
  queued: number;
  skipped: number;
}

/**
 * Queues notifications for an item. Idempotent — the unique (userId, itemId)
 * means a replay or a re-ingest cannot double-notify.
 */
export async function fanOutForItem(itemId: string): Promise<FanOutResult> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, sourceId: true, status: true },
  });

  // Only published pieces notify. A devotional held for review must never
  // reach a reader's lock screen before a human has looked at it.
  if (!item || item.status !== ItemStatus.PUBLISHED) return { queued: 0, skipped: 0 };

  const prefs = await prisma.notificationPref.findMany({
    where: {
      sourceId: item.sourceId,
      enabled: true,
      // No point queueing for a reader with no device registered.
      user: { subscriptions: { some: {} } },
    },
    select: {
      deliverHour: true,
      user: { select: { id: true, timezone: true } },
    },
  });

  const now = new Date();
  let queued = 0;
  let skipped = 0;

  for (const pref of prefs) {
    const zone = safeTimeZone(pref.user.timezone);
    const { deliverAfter } = resolveDelivery(now, zone, pref.deliverHour ?? null);

    try {
      await prisma.pendingNotification.create({
        data: {
          userId: pref.user.id,
          sourceId: item.sourceId,
          itemId: item.id,
          deliverAfter,
        },
      });
      queued += 1;
    } catch {
      // Unique violation — already queued for this reader.
      skipped += 1;
    }
  }

  return { queued, skipped };
}
