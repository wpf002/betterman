import { ItemStatus, prisma } from '@betterman/db';
import type { Publication } from './publications';

/** One row in an archive list. */
export interface ArchiveEntry {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  publishedAt: Date;
  /** Devotionals only — shown instead of a subtitle. */
  scriptureRef: string | null;
}

/**
 * Every published item in one publication, newest first.
 *
 * Items held in REVIEW are excluded: a devotional whose parse we do not trust
 * must not reach a reader (spec §9).
 */
export async function getArchive(pub: Publication): Promise<ArchiveEntry[]> {
  const items = await prisma.item.findMany({
    where: { source: { key: pub.key }, status: ItemStatus.PUBLISHED },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      publishedAt: true,
      devotional: { select: { scriptureRef: true } },
    },
  });

  return items.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    subtitle: item.subtitle,
    publishedAt: item.publishedAt,
    scriptureRef: item.devotional?.scriptureRef ?? null,
  }));
}

/** The latest published piece in each publication, for the home chooser. */
export async function getLatestByPublication(
  publications: readonly Publication[],
): Promise<Map<string, ArchiveEntry | null>> {
  const entries = await Promise.all(
    publications.map(async (pub) => {
      const item = await prisma.item.findFirst({
        where: { source: { key: pub.key }, status: ItemStatus.PUBLISHED },
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          publishedAt: true,
          devotional: { select: { scriptureRef: true } },
        },
      });

      const entry: ArchiveEntry | null = item
        ? {
            id: item.id,
            slug: item.slug,
            title: item.title,
            subtitle: item.subtitle,
            publishedAt: item.publishedAt,
            scriptureRef: item.devotional?.scriptureRef ?? null,
          }
        : null;

      return [pub.slug, entry] as const;
    }),
  );

  return new Map(entries);
}

export async function countPublished(pub: Publication): Promise<number> {
  return prisma.item.count({
    where: { source: { key: pub.key }, status: ItemStatus.PUBLISHED },
  });
}
