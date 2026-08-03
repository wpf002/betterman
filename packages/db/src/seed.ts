/**
 * Seeds the three publications.
 *
 * Compiled into dist rather than run through tsx: tsx is a devDependency, and
 * a production install may not have it. Migrations create the tables, but the
 * source rows are data — without them ingest fails with "No Source found",
 * which reads like a code bug rather than an empty database.
 *
 * Idempotent, so it is safe on every boot.
 */
import { PrismaClient, SourceKey, SourceKind } from '@prisma/client';

const SOURCES = [
  {
    key: SourceKey.BETTERMORNINGS,
    kind: SourceKind.EMAIL,
    name: 'BetterMornings',
    slug: 'bettermornings',
    homeUrl: 'https://betterman.com/daily-devotional',
    feedUrl: null,
    apiHost: null,
  },
  {
    key: SourceKey.GOOD_TROUBLE,
    kind: SourceKind.SUBSTACK,
    name: 'Good Trouble',
    slug: 'good-trouble',
    homeUrl: 'https://charper.substack.com',
    feedUrl: 'https://charper.substack.com/feed',
    apiHost: 'charper.substack.com',
  },
  {
    key: SourceKey.JOSIAH_JONES,
    kind: SourceKind.SUBSTACK,
    name: 'Josiah Jones',
    slug: 'josiah-jones',
    homeUrl: 'https://josiahjones1.substack.com',
    feedUrl: 'https://josiahjones1.substack.com/feed',
    apiHost: 'josiahjones1.substack.com',
  },
] as const;

export async function seedSources(prisma: PrismaClient): Promise<number> {
  for (const source of SOURCES) {
    await prisma.source.upsert({
      where: { key: source.key },
      create: { ...source },
      update: {
        kind: source.kind,
        name: source.name,
        slug: source.slug,
        homeUrl: source.homeUrl,
        feedUrl: source.feedUrl,
        apiHost: source.apiHost,
      },
    });
  }
  return prisma.source.count();
}

const prisma = new PrismaClient();
seedSources(prisma)
  .then((count) => console.log(`seeded sources — ${count} total`))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
