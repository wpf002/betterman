'use server';

import { revalidatePath } from 'next/cache';
import { SourceKey, prisma } from '@betterman/db';
import { getSessionUser } from '../auth/session';

/**
 * Notification preferences and device registration.
 *
 * A subscription belongs to a device; a preference belongs to the reader. Both
 * hang off the account, so enabling BetterMornings on a phone also enables it
 * on a laptop the reader has signed into.
 */

export interface SubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  /** IANA zone from the browser, so delivery lands at the right local hour. */
  timezone?: string;
}

export async function registerDevice(input: SubscriptionInput): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };

  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent?.slice(0, 255) ?? null,
    },
    // A re-subscribe on the same endpoint may belong to a different account
    // if two people share a device, so the owner is refreshed too.
    update: {
      userId: user.id,
      p256dh: input.p256dh,
      auth: input.auth,
      failureCount: 0,
    },
  });

  if (input.timezone) {
    await prisma.user.update({
      where: { id: user.id },
      data: { timezone: input.timezone },
    });
  }

  revalidatePath('/settings');
  return { ok: true };
}

export async function unregisterDevice(endpoint: string): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  revalidatePath('/settings');
  return { ok: true };
}

export async function setPublicationPref(
  sourceKey: SourceKey,
  enabled: boolean,
): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };

  const source = await prisma.source.findUnique({
    where: { key: sourceKey },
    select: { id: true, key: true },
  });
  if (!source) return { ok: false };

  // Only BetterMornings has a morning ritual to respect; the Substacks notify
  // as soon as they land (spec §10).
  const deliverHour = source.key === SourceKey.BETTERMORNINGS ? 6 : null;

  await prisma.notificationPref.upsert({
    where: { userId_sourceId: { userId: user.id, sourceId: source.id } },
    create: { userId: user.id, sourceId: source.id, enabled, deliverHour },
    update: { enabled },
  });

  revalidatePath('/settings');
  return { ok: true };
}

export async function setDeliveryHour(hour: number): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };

  const source = await prisma.source.findUnique({
    where: { key: SourceKey.BETTERMORNINGS },
    select: { id: true },
  });
  if (!source) return { ok: false };

  await prisma.notificationPref.updateMany({
    where: { userId: user.id, sourceId: source.id },
    data: { deliverHour: Math.max(0, Math.min(23, Math.round(hour))) },
  });

  revalidatePath('/settings');
  return { ok: true };
}

export interface NotificationSettings {
  prefs: Record<string, boolean>;
  deliverHour: number;
  deviceCount: number;
  timezone: string;
}

export async function getNotificationSettings(): Promise<NotificationSettings | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const [prefRows, deviceCount] = await Promise.all([
    prisma.notificationPref.findMany({
      where: { userId: user.id },
      select: { enabled: true, deliverHour: true, source: { select: { key: true } } },
    }),
    prisma.pushSubscription.count({ where: { userId: user.id } }),
  ]);

  const prefs: Record<string, boolean> = {};
  let deliverHour = 6;

  for (const row of prefRows) {
    prefs[row.source.key] = row.enabled;
    if (row.source.key === SourceKey.BETTERMORNINGS && row.deliverHour !== null) {
      deliverHour = row.deliverHour;
    }
  }

  return { prefs, deliverHour, deviceCount, timezone: user.timezone };
}
