import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';
export { PrismaClient };

/**
 * A single client per process. Next dev and tsx watch both re-evaluate modules
 * on reload, which would otherwise open a new pool on every edit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** The three publications, keyed as in the schema. Routes come from `slug`. */
export const SOURCE_SLUGS = {
  BETTERMORNINGS: 'bettermornings',
  GOOD_TROUBLE: 'good-trouble',
  JOSIAH_JONES: 'josiah-jones',
} as const;

export type SourceSlug = (typeof SOURCE_SLUGS)[keyof typeof SOURCE_SLUGS];
