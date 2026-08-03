/**
 * Idempotent writes. Ingest may re-run at any time and must not create
 * duplicates or churn rows (spec §13): dedupe on (sourceId, externalId), and
 * only write when `contentHash` actually changed.
 */
import { ItemStatus, prisma, type Prisma, type Source } from '@betterman/db';
import type { NormalizedItem } from '../substack/normalize.js';
import { hashContent } from '../substack/normalize.js';
import { sanitizeDevotionalHtml, htmlToText } from '../html/sanitize.js';
import { parseDevotional, shouldPublish, toDateKey } from '../devotional/parse.js';
import type { ParsedScriptureRef } from '../devotional/scripture.js';

export type UpsertOutcome = 'created' | 'updated' | 'unchanged';

export interface UpsertResult {
  outcome: UpsertOutcome;
  itemId: string;
  status: ItemStatus;
}

/** Writes one normalized item, plus its scripture index rows. */
export async function upsertItem(
  source: Pick<Source, 'id'>,
  item: NormalizedItem,
  extra: {
    status?: ItemStatus;
    devotional?: Prisma.DevotionalUncheckedCreateWithoutItemInput;
    scriptureRefs?: ParsedScriptureRef[];
  } = {},
): Promise<UpsertResult> {
  const status = extra.status ?? ItemStatus.PUBLISHED;

  const existing = await prisma.item.findUnique({
    where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
    select: { id: true, contentHash: true, status: true },
  });

  // Nothing upstream changed and the gate verdict is the same — leave it alone
  // so re-running ingest is a genuine no-op.
  if (existing && existing.contentHash === item.contentHash && existing.status === status) {
    return { outcome: 'unchanged', itemId: existing.id, status: existing.status };
  }

  const data = {
    sourceId: source.id,
    externalId: item.externalId,
    slug: item.slug,
    title: item.title,
    subtitle: item.subtitle,
    publishedAt: item.publishedAt,
    canonicalUrl: item.canonicalUrl,
    heroImageUrl: item.heroImageUrl,
    contentHtml: item.contentHtml,
    contentText: item.contentText,
    contentHash: item.contentHash,
    status,
  };

  const record = await prisma.item.upsert({
    where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
    create: data,
    update: data,
    select: { id: true, status: true },
  });

  if (extra.devotional) {
    const { itemId: _ignored, ...devotional } = extra.devotional as { itemId?: string } & Record<
      string,
      unknown
    >;
    await prisma.devotional.upsert({
      where: { itemId: record.id },
      create: { ...(devotional as Prisma.DevotionalUncheckedCreateWithoutItemInput), itemId: record.id },
      update: devotional as Prisma.DevotionalUncheckedUpdateWithoutItemInput,
    });
  }

  if (extra.scriptureRefs) {
    // Replace wholesale: the set is small and this keeps the index exactly in
    // step with the current parse.
    await prisma.scriptureRef.deleteMany({ where: { itemId: record.id } });
    if (extra.scriptureRefs.length) {
      await prisma.scriptureRef.createMany({
        data: extra.scriptureRefs.map((ref) => ({ ...ref, itemId: record.id })),
      });
    }
  }

  return {
    outcome: existing ? 'updated' : 'created',
    itemId: record.id,
    status: record.status,
  };
}

/**
 * Turns one BetterMornings email into an item + devotional. Sanitizing and
 * parsing both happen here, on ingest.
 */
export async function ingestDevotionalEmail(
  source: Pick<Source, 'id'>,
  rawHtml: string,
  opts: { messageId?: string; receivedAt?: Date } = {},
): Promise<UpsertResult & { parseQuality: number; dateKey: string | null }> {
  const parsed = parseDevotional(rawHtml);
  const contentHtml = sanitizeDevotionalHtml(rawHtml);

  const date = parsed.date ?? opts.receivedAt ?? new Date();
  const dateKey = parsed.dateKey ?? toDateKey(date);

  // The calendar date is the natural key: a resend of the same morning must
  // not create a second devotional. The Message-ID is only a fallback for a
  // devotional whose date we could not read.
  const externalId = parsed.dateKey ?? opts.messageId ?? dateKey;

  const item: NormalizedItem = {
    externalId,
    slug: dateKey,
    title: parsed.title ?? dateKey,
    subtitle: null,
    publishedAt: opts.receivedAt ?? date,
    canonicalUrl: null,
    heroImageUrl: null,
    contentHtml,
    contentText: htmlToText(contentHtml),
    contentHash: hashContent(rawHtml),
  };

  const publish = shouldPublish(parsed.parseQuality);

  const result = await upsertItem(source, item, {
    status: publish ? ItemStatus.PUBLISHED : ItemStatus.REVIEW,
    devotional: {
      date,
      scriptureText: parsed.scriptureText,
      scriptureRef: parsed.scriptureRef,
      thought: parsed.thought,
      reflect: parsed.reflect,
      rightNextStep: parsed.rightNextStep,
      prayer: parsed.prayer,
      parseQuality: parsed.parseQuality,
      templateEra: parsed.templateEra,
      unmatched: parsed.unmatched.length ? parsed.unmatched : undefined,
    } as Prisma.DevotionalUncheckedCreateWithoutItemInput,
    scriptureRefs: parsed.scriptureRefs,
  });

  return { ...result, parseQuality: parsed.parseQuality, dateKey };
}

/** Every ingest run keeps what it received, so a parser fix can be replayed. */
export async function storeRawPayload(input: {
  sourceId?: string | null;
  runId?: string | null;
  kind: string;
  externalId?: string | null;
  body: string;
}): Promise<void> {
  await prisma.rawPayload.create({
    data: {
      sourceId: input.sourceId ?? null,
      runId: input.runId ?? null,
      kind: input.kind,
      externalId: input.externalId ?? null,
      body: input.body,
      bodyHash: hashContent(input.body),
    },
  });
}
