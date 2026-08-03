import { IngestStatus, ItemStatus, prisma } from '@betterman/db';
import { PUBLICATIONS } from '../publications';
import { formatDevotionalDate, formatLongDate } from '../dates';

/** Ingest health, per publication (spec §12, Phase 8). */
export interface SourceHealth {
  name: string;
  slug: string;
  published: number;
  inReview: number;
  latestPublishedAt: Date | null;
  lastRunAt: Date | null;
  lastRunStatus: IngestStatus | null;
  lastRunError: string | null;
}

export async function getSourceHealth(): Promise<SourceHealth[]> {
  const sources = await prisma.source.findMany({
    select: { id: true, key: true, name: true, slug: true },
  });

  return Promise.all(
    sources
      .sort(
        (a, b) =>
          PUBLICATIONS.findIndex((p) => p.key === a.key) -
          PUBLICATIONS.findIndex((p) => p.key === b.key),
      )
      .map(async (source) => {
        const [published, inReview, latest, lastRun] = await Promise.all([
          prisma.item.count({ where: { sourceId: source.id, status: ItemStatus.PUBLISHED } }),
          prisma.item.count({ where: { sourceId: source.id, status: ItemStatus.REVIEW } }),
          prisma.item.findFirst({
            where: { sourceId: source.id, status: ItemStatus.PUBLISHED },
            orderBy: { publishedAt: 'desc' },
            select: { publishedAt: true },
          }),
          prisma.ingestRun.findFirst({
            where: { sourceId: source.id },
            orderBy: { startedAt: 'desc' },
            select: { startedAt: true, status: true, error: true },
          }),
        ]);

        return {
          name: source.name,
          slug: source.slug,
          published,
          inReview,
          latestPublishedAt: latest?.publishedAt ?? null,
          lastRunAt: lastRun?.startedAt ?? null,
          lastRunStatus: lastRun?.status ?? null,
          lastRunError: lastRun?.error ?? null,
        };
      }),
  );
}

export async function getRecentRuns(limit = 12) {
  return prisma.ingestRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      trigger: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      itemsSeen: true,
      itemsCreated: true,
      itemsUpdated: true,
      itemsSkipped: true,
      itemsInReview: true,
      error: true,
      source: { select: { name: true } },
    },
  });
}

/** The parse review queue — everything held back from readers. */
export interface ReviewEntry {
  id: string;
  slug: string;
  title: string;
  publication: string;
  href: string;
  /**
   * Pre-formatted here rather than in the page. A devotional's date is a
   * calendar day stored as UTC midnight, so formatting it in Central slides it
   * back a day — the same trap the archive list already had to avoid.
   */
  dateLabel: string;
  parseQuality: number | null;
  templateEra: string | null;
  unmatched: string[];
  missing: string[];
}

const DEVOTIONAL_FIELDS: Array<[key: string, label: string]> = [
  ['scriptureText', 'Scripture'],
  ['scriptureRef', 'Reference'],
  ['thought', 'Thought'],
  ['reflect', 'Reflect'],
  ['rightNextStep', 'Right Next Step'],
  ['prayer', 'Prayer'],
];

export async function getReviewQueue(): Promise<ReviewEntry[]> {
  const items = await prisma.item.findMany({
    where: { status: ItemStatus.REVIEW },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      publishedAt: true,
      source: { select: { key: true } },
      devotional: {
        select: {
          parseQuality: true,
          templateEra: true,
          unmatched: true,
          scriptureText: true,
          scriptureRef: true,
          thought: true,
          reflect: true,
          rightNextStep: true,
          prayer: true,
        },
      },
    },
  });

  return items.flatMap((item) => {
    const pub = PUBLICATIONS.find((p) => p.key === item.source.key);
    if (!pub) return [];

    const devotional = item.devotional;
    const missing = devotional
      ? DEVOTIONAL_FIELDS.filter(
          ([key]) => !devotional[key as keyof typeof devotional],
        ).map(([, label]) => label)
      : [];

    const unmatched = Array.isArray(devotional?.unmatched)
      ? (devotional.unmatched as unknown[]).map(String)
      : [];

    return [
      {
        id: item.id,
        slug: item.slug,
        title: item.title,
        publication: pub.name,
        href: `/${pub.slug}/${item.slug}`,
        dateLabel:
          pub.slug === 'bettermornings'
            ? formatDevotionalDate(item.slug)
            : formatLongDate(item.publishedAt),
        parseQuality: devotional?.parseQuality ?? null,
        templateEra: devotional?.templateEra ?? null,
        unmatched,
        missing,
      },
    ];
  });
}
