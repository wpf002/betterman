import { ItemStatus, prisma } from '@betterman/db';
import { PUBLICATIONS } from '../publications';

/**
 * The Scripture index (spec §12, Phase 7): every passage ever taught,
 * browsable by book and chapter, linking to each devotional that used it.
 *
 * Books are ordered canonically rather than alphabetically — a reader looking
 * for Genesis expects it first, not after Ephesians.
 */

const CANONICAL_ORDER = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalm', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians',
  '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
  'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude',
  'Revelation',
];

const orderOf = (book: string) => {
  const i = CANONICAL_ORDER.indexOf(book);
  return i === -1 ? CANONICAL_ORDER.length : i;
};

/** URL-safe slug for a book name: "1 Thessalonians" → "1-thessalonians". */
export function bookToSlug(book: string): string {
  return book.toLowerCase().replace(/\s+/g, '-');
}

export function slugToBook(slug: string): string | null {
  const normalized = slug.toLowerCase();
  return CANONICAL_ORDER.find((b) => bookToSlug(b) === normalized) ?? null;
}

export interface BookSummary {
  book: string;
  slug: string;
  passages: number;
  chapters: number[];
}

export async function getBooks(): Promise<BookSummary[]> {
  const rows = await prisma.scriptureRef.findMany({
    where: { item: { status: ItemStatus.PUBLISHED } },
    select: { book: true, chapter: true },
  });

  const byBook = new Map<string, Set<number>>();
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!byBook.has(row.book)) byBook.set(row.book, new Set());
    byBook.get(row.book)?.add(row.chapter);
    counts.set(row.book, (counts.get(row.book) ?? 0) + 1);
  }

  return [...byBook.entries()]
    .map(([book, chapters]) => ({
      book,
      slug: bookToSlug(book),
      passages: counts.get(book) ?? 0,
      chapters: [...chapters].sort((a, b) => a - b),
    }))
    .sort((a, b) => orderOf(a.book) - orderOf(b.book));
}

export interface PassageEntry {
  itemId: string;
  href: string;
  publication: string;
  title: string;
  publishedAt: Date;
  displayRef: string;
  /** The passage the piece is built on, rather than one quoted in passing. */
  isPrimary: boolean;
}

export async function getChapter(book: string, chapter: number): Promise<PassageEntry[]> {
  const rows = await prisma.scriptureRef.findMany({
    where: { book, chapter, item: { status: ItemStatus.PUBLISHED } },
    orderBy: [{ verseStart: 'asc' }],
    select: {
      itemId: true,
      displayRef: true,
      isPrimary: true,
      verseStart: true,
      item: {
        select: { slug: true, title: true, publishedAt: true, source: { select: { key: true } } },
      },
    },
  });

  return rows
    .flatMap((row) => {
      const pub = PUBLICATIONS.find((p) => p.key === row.item.source.key);
      if (!pub) return [];
      return [
        {
          itemId: row.itemId,
          href: `/${pub.slug}/${row.item.slug}`,
          publication: pub.name,
          title: row.item.title,
          publishedAt: row.item.publishedAt,
          displayRef: row.displayRef,
          isPrimary: row.isPrimary,
        },
      ];
    })
    // The passage a devotional is built on leads; passing mentions follow.
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return b.publishedAt.getTime() - a.publishedAt.getTime();
    });
}

/**
 * Every passage in a book, with the piece that taught it. Flat: a chapter list
 * in between was an extra tap for no information.
 */
export async function getPassagesForBook(book: string): Promise<PassageEntry[]> {
  const rows = await prisma.scriptureRef.findMany({
    where: { book, item: { status: ItemStatus.PUBLISHED } },
    orderBy: [{ chapter: 'asc' }, { verseStart: 'asc' }],
    select: {
      itemId: true,
      displayRef: true,
      isPrimary: true,
      item: {
        select: { slug: true, title: true, publishedAt: true, source: { select: { key: true } } },
      },
    },
  });

  return rows.flatMap((row) => {
    const pub = PUBLICATIONS.find((p) => p.key === row.item.source.key);
    if (!pub) return [];
    return [
      {
        itemId: row.itemId,
        href: `/${pub.slug}/${row.item.slug}`,
        publication: pub.name,
        title: row.item.title,
        publishedAt: row.item.publishedAt,
        displayRef: row.displayRef,
        isPrimary: row.isPrimary,
      },
    ];
  });
}

export async function getChaptersFor(book: string): Promise<Array<{ chapter: number; count: number }>> {
  const rows = await prisma.scriptureRef.groupBy({
    by: ['chapter'],
    where: { book, item: { status: ItemStatus.PUBLISHED } },
    _count: { _all: true },
    orderBy: { chapter: 'asc' },
  });

  return rows.map((row) => ({ chapter: row.chapter, count: row._count._all }));
}
