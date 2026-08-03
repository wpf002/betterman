import { Prisma, prisma } from '@betterman/db';
import { PUBLICATIONS } from '../publications';

/**
 * Full-text search over every published piece (spec §12, Phase 7).
 *
 * Uses `websearch_to_tsquery`, so a reader can quote a phrase the way they
 * would in any search box and get phrase matching rather than loose AND. The
 * ranking comes from the weighted `searchVector` generated column, which is
 * what makes a title match beat the same words buried in a body.
 */

/**
 * Snippet delimiters. Deliberately not `<b>`: `contentText` is plaintext that
 * may contain angle brackets or ampersands, and returning HTML from the
 * database would mean trusting it at render time. These markers cannot occur
 * in the source, so the highlight is split in JS and rendered as elements.
 */
const START_SEL = '';
const STOP_SEL = '';

export interface SearchHit {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  publishedAt: Date;
  href: string;
  publication: string;
  rank: number;
  /** Alternating plain/highlighted runs, already split. */
  snippet: Array<{ text: string; match: boolean }>;
}

interface SearchRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  publishedAt: Date;
  sourceKey: string;
  rank: number;
  snippet: string | null;
}

/** Splits a ts_headline result on the private-use markers. */
function splitSnippet(raw: string | null): SearchHit['snippet'] {
  if (!raw) return [];
  return raw
    .split(new RegExp(`[${START_SEL}${STOP_SEL}]`))
    .map((text, i) => ({ text, match: i % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}

export async function search(query: string, limit = 40): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const headlineOptions = [
    `StartSel=${START_SEL}`,
    `StopSel=${STOP_SEL}`,
    'MaxWords=38',
    'MinWords=18',
    'ShortWord=3',
    'MaxFragments=1',
    'FragmentDelimiter= … ',
  ].join(', ');

  const rows = await prisma.$queryRaw<SearchRow[]>(Prisma.sql`
    SELECT
      i.id,
      i.slug,
      i.title,
      i.subtitle,
      i."publishedAt",
      s.key AS "sourceKey",
      ts_rank_cd(i."searchVector", q) AS rank,
      ts_headline('english', coalesce(i."contentText", ''), q, ${headlineOptions}) AS snippet
    FROM items i
    JOIN sources s ON s.id = i."sourceId",
      websearch_to_tsquery('english', ${trimmed}) AS q
    WHERE i.status = 'PUBLISHED'
      AND i."searchVector" @@ q
    ORDER BY rank DESC, i."publishedAt" DESC
    LIMIT ${limit}
  `);

  return rows.flatMap((row) => {
    const pub = PUBLICATIONS.find((p) => p.key === row.sourceKey);
    if (!pub) return [];
    return [
      {
        id: row.id,
        slug: row.slug,
        title: row.title,
        subtitle: row.subtitle,
        publishedAt: row.publishedAt,
        href: `/${pub.slug}/${row.slug}`,
        publication: pub.name,
        rank: Number(row.rank),
        snippet: splitSnippet(row.snippet),
      },
    ];
  });
}
