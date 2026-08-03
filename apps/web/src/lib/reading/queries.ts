import { prisma } from '@betterman/db';
import { PUBLICATIONS } from '../publications';

/** What the reader has done with one piece. Null user → all false. */
export interface ReaderState {
  bookmarked: boolean;
  nextStepSaved: boolean;
  percent: number;
}

export async function getReaderState(
  userId: string | null,
  itemId: string,
): Promise<ReaderState> {
  if (!userId) return { bookmarked: false, nextStepSaved: false, percent: 0 };

  const [bookmark, step, progress] = await Promise.all([
    prisma.bookmark.findUnique({
      where: { userId_itemId: { userId, itemId } },
      select: { id: true },
    }),
    prisma.savedNextStep.findUnique({
      where: { userId_itemId: { userId, itemId } },
      select: { id: true },
    }),
    prisma.readingProgress.findUnique({
      where: { userId_itemId: { userId, itemId } },
      select: { percent: true },
    }),
  ]);

  return {
    bookmarked: Boolean(bookmark),
    nextStepSaved: Boolean(step),
    percent: progress?.percent ?? 0,
  };
}

export interface SavedPiece {
  itemId: string;
  href: string;
  publication: string;
  title: string;
  publishedAt: Date;
}

export interface SavedStep extends SavedPiece {
  stepText: string;
  completedAt: Date | null;
}

const hrefFor = (sourceKey: string, slug: string) => {
  const pub = PUBLICATIONS.find((p) => p.key === sourceKey);
  return pub ? { href: `/${pub.slug}/${slug}`, publication: pub.name } : null;
};

export async function getBookmarks(userId: string): Promise<SavedPiece[]> {
  const rows = await prisma.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      itemId: true,
      item: {
        select: { slug: true, title: true, publishedAt: true, source: { select: { key: true } } },
      },
    },
  });

  return rows.flatMap((row) => {
    const link = hrefFor(row.item.source.key, row.item.slug);
    if (!link) return [];
    return [
      {
        itemId: row.itemId,
        href: link.href,
        publication: link.publication,
        title: row.item.title,
        publishedAt: row.item.publishedAt,
      },
    ];
  });
}

export async function getSavedSteps(userId: string): Promise<SavedStep[]> {
  const rows = await prisma.savedNextStep.findMany({
    where: { userId },
    orderBy: [{ completedAt: 'asc' }, { createdAt: 'desc' }],
    select: {
      itemId: true,
      stepText: true,
      completedAt: true,
      item: {
        select: { slug: true, title: true, publishedAt: true, source: { select: { key: true } } },
      },
    },
  });

  return rows.flatMap((row) => {
    const link = hrefFor(row.item.source.key, row.item.slug);
    if (!link) return [];
    return [
      {
        itemId: row.itemId,
        href: link.href,
        publication: link.publication,
        title: row.item.title,
        publishedAt: row.item.publishedAt,
        stepText: row.stepText,
        completedAt: row.completedAt,
      },
    ];
  });
}
