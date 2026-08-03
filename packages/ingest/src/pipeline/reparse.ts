/**
 * Replaying one stored payload through the current parser.
 *
 * This is what the `raw_payloads` table exists for (spec §9): a parser fix can
 * be applied to a piece that is already stored, without re-fetching it — which
 * is the only option at all for the devotional archive, whose mailbox app
 * password has since been revoked.
 */
import { SourceKind, prisma } from '@betterman/db';
import { recoverHtml } from '../email/payload.js';
import { normalizeSubstackPost } from '../substack/normalize.js';
import { ingestDevotionalEmail, upsertItem } from './upsert.js';

export interface ReparseResult {
  ok: boolean;
  reason?: string;
  parseQuality?: number;
  status?: string;
}

/** Re-runs the parser for a single item from its most recent stored payload. */
export async function reparseItem(itemId: string): Promise<ReparseResult> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      externalId: true,
      slug: true,
      title: true,
      subtitle: true,
      publishedAt: true,
      canonicalUrl: true,
      heroImageUrl: true,
      sourceId: true,
      source: { select: { id: true, kind: true, apiHost: true } },
    },
  });
  if (!item) return { ok: false, reason: 'item not found' };

  if (item.source.kind === SourceKind.EMAIL) {
    // Devotional payloads are keyed by Message-ID, which the item does not
    // carry, so fall back to the most recent email payload for this source
    // whose parse resolves to the same date slug.
    const payloads = await prisma.rawPayload.findMany({
      where: { sourceId: item.sourceId, kind: 'email-mime' },
      orderBy: { receivedAt: 'desc' },
      select: { body: true },
      take: 400,
    });

    for (const payload of payloads) {
      const recovered = await recoverHtml(payload.body);
      if (!recovered.html) continue;

      const { parseDevotional } = await import('../devotional/parse.js');
      const parsed = parseDevotional(recovered.html);
      if (parsed.dateKey !== item.slug) continue;

      const result = await ingestDevotionalEmail(
        { id: item.sourceId },
        recovered.html,
        {
          messageId: recovered.messageId,
          receivedAt: recovered.receivedAt,
          force: true,
        },
      );
      return { ok: true, parseQuality: result.parseQuality, status: result.status };
    }

    return { ok: false, reason: 'no stored email payload matches this devotional' };
  }

  const payload = await prisma.rawPayload.findFirst({
    where: { sourceId: item.sourceId, kind: 'substack-post-json', externalId: item.externalId },
    orderBy: { receivedAt: 'desc' },
    select: { body: true },
  });
  if (!payload) return { ok: false, reason: 'no stored payload for this article' };

  const normalized = normalizeSubstackPost(
    {
      id: Number(item.externalId),
      slug: item.slug,
      title: item.title,
      subtitle: item.subtitle,
      post_date: item.publishedAt.toISOString(),
      canonical_url: item.canonicalUrl,
      cover_image: item.heroImageUrl,
      audience: 'everyone',
      type: 'newsletter',
    },
    payload.body,
    item.source.apiHost ?? '',
  );

  const result = await upsertItem({ id: item.sourceId }, normalized, { force: true });
  return { ok: true, status: result.status };
}
