import webpush, { WebPushError } from 'web-push';
import { prisma } from '@betterman/db';
import { env } from '../env.js';

/**
 * Web Push delivery.
 *
 * A subscription is a device, not a person, so one reader may have several.
 * Endpoints expire constantly — a reinstalled app, a cleared browser — and the
 * push service says so with 404 or 410. Those are pruned rather than retried;
 * anything else is left alone, since a transient 5xx is not a dead device.
 */

let configured = false;

export function configurePush(): boolean {
  if (configured) return true;
  if (!env.vapidPublicKey || !env.vapidPrivateKey) return false;

  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Deep link straight to the piece (spec §10). */
  url: string;
  tag: string;
}

export type SendOutcome = 'sent' | 'expired' | 'failed';

export async function sendToSubscription(
  subscription: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<SendOutcome> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 12 * 60 * 60, urgency: 'normal' },
    );

    await prisma.pushSubscription.update({
      where: { id: subscription.id },
      data: { lastUsedAt: new Date(), failureCount: 0 },
    });

    return 'sent';
  } catch (err) {
    const status = err instanceof WebPushError ? err.statusCode : 0;

    if (status === 404 || status === 410) {
      await prisma.pushSubscription
        .delete({ where: { id: subscription.id } })
        .catch(() => undefined);
      return 'expired';
    }

    await prisma.pushSubscription
      .update({
        where: { id: subscription.id },
        data: { failureCount: { increment: 1 } },
      })
      .catch(() => undefined);

    return 'failed';
  }
}
