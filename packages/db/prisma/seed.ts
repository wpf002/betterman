/**
 * Seeds the three publications. Idempotent — safe to re-run on every deploy.
 */
import { PrismaClient, SourceKey, SourceKind } from '@prisma/client';

const prisma = new PrismaClient();

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

async function main() {
  for (const s of SOURCES) {
    await prisma.source.upsert({
      where: { key: s.key },
      create: { ...s },
      update: {
        kind: s.kind,
        name: s.name,
        slug: s.slug,
        homeUrl: s.homeUrl,
        feedUrl: s.feedUrl,
        apiHost: s.apiHost,
      },
    });
  }
  const count = await prisma.source.count();
  console.log(`seeded sources — ${count} total`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
