/**
 * Replay stored payloads through the current parser.
 *
 *   pnpm reparse                 # everything
 *   pnpm reparse --source bettermornings
 *
 * No network, no credentials. Every ingest run stores exactly what it received
 * (spec §9), so a parser or sanitizer fix can be applied to the whole archive
 * from the database alone — which is the only way to do it once a mailbox app
 * password has been revoked, or a Substack post has been edited upstream.
 */
import { ItemStatus, SourceKey, prisma } from '@betterman/db';
import { recoverHtml } from '../src/email/payload.js';
import { ingestDevotionalEmail, upsertItem } from '../src/pipeline/upsert.js';
import { normalizeSubstackPost } from '../src/substack/normalize.js';

const args = process.argv.slice(2);
const sourceFlag = args.indexOf('--source');
const only = sourceFlag !== -1 ? args[sourceFlag + 1] : undefined;

async function reparseDevotionals() {
  const source = await prisma.source.findUniqueOrThrow({
    where: { key: SourceKey.BETTERMORNINGS },
  });

  // Latest stored payload per message.
  const payloads = await prisma.rawPayload.findMany({
    where: { sourceId: source.id, kind: 'email-mime' },
    orderBy: { receivedAt: 'desc' },
    select: { externalId: true, body: true },
  });

  const seen = new Set<string>();
  let changed = 0;
  let held = 0;

  for (const payload of payloads) {
    const key = payload.externalId ?? payload.body.slice(0, 64);
    if (seen.has(key)) continue;
    seen.add(key);

    const recovered = await recoverHtml(payload.body);
    if (!recovered.html) {
      console.log(`  ! ${key.slice(0, 48)}: no HTML recoverable — skipped`);
      continue;
    }

    const result = await ingestDevotionalEmail(source, recovered.html, {
      messageId: recovered.messageId,
      receivedAt: recovered.receivedAt,
      force: true,
    });

    if (result.outcome !== 'unchanged') changed += 1;
    if (result.status === ItemStatus.REVIEW) {
      held += 1;
      console.log(`  [REVIEW] ${result.dateKey} q=${result.parseQuality.toFixed(3)}`);
    }
  }

  console.log(`BetterMornings: ${seen.size} replayed, ${changed} rewritten, ${held} held`);
}

async function reparseSubstack() {
  const sources = await prisma.source.findMany({
    where: { key: { in: [SourceKey.GOOD_TROUBLE, SourceKey.JOSIAH_JONES] } },
  });

  for (const source of sources) {
    const payloads = await prisma.rawPayload.findMany({
      where: { sourceId: source.id, kind: 'substack-post-json' },
      orderBy: { receivedAt: 'desc' },
      select: { externalId: true, body: true },
    });

    const seen = new Set<string>();
    let changed = 0;

    for (const payload of payloads) {
      if (!payload.externalId || seen.has(payload.externalId)) continue;
      seen.add(payload.externalId);

      // The archive row is already stored on the item; only the body needs
      // re-sanitizing, so the existing row supplies the metadata.
      const item = await prisma.item.findUnique({
        where: {
          sourceId_externalId: { sourceId: source.id, externalId: payload.externalId },
        },
        select: {
          slug: true,
          title: true,
          subtitle: true,
          publishedAt: true,
          canonicalUrl: true,
          heroImageUrl: true,
        },
      });
      if (!item) continue;

      const normalized = normalizeSubstackPost(
        {
          id: Number(payload.externalId),
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
        source.apiHost ?? '',
      );

      const result = await upsertItem(source, normalized, { force: true });
      if (result.outcome !== 'unchanged') changed += 1;
    }

    console.log(`${source.name}: ${seen.size} replayed, ${changed} rewritten`);
  }
}

async function main() {
  if (!only || only === 'bettermornings') await reparseDevotionals();
  if (!only || only === 'substack') await reparseSubstack();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
