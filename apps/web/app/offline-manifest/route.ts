import { NextResponse } from 'next/server';
import { ItemStatus, prisma } from '@betterman/db';
import { PUBLICATIONS } from '@/lib/publications';

/**
 * The URLs the service worker precaches so the last 30 days read offline
 * (spec §12, Phase 4).
 *
 * This is computed server-side rather than guessed in the worker: the cutoff
 * depends on what has actually been published, and BetterMornings can go a
 * weekend without a new piece while Good Trouble posts twice.
 */
export const dynamic = 'force-dynamic';

const DAYS = 30;

export async function GET() {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const bySlug = new Map(PUBLICATIONS.map((p) => [p.key, p.slug]));

  const items = await prisma.item.findMany({
    where: { status: ItemStatus.PUBLISHED, publishedAt: { gte: since } },
    orderBy: { publishedAt: 'desc' },
    select: { slug: true, source: { select: { key: true } } },
  });

  const urls = [
    '/',
    ...PUBLICATIONS.map((p) => `/${p.slug}`),
    '/settings',
    ...items
      .map((item) => {
        const pub = bySlug.get(item.source.key);
        return pub ? `/${pub}/${item.slug}` : null;
      })
      .filter((url): url is string => url !== null),
  ];

  return NextResponse.json(
    { days: DAYS, count: urls.length, urls },
    // Let the worker re-check hourly; the list only moves when ingest runs.
    { headers: { 'cache-control': 'public, max-age=0, s-maxage=3600' } },
  );
}
