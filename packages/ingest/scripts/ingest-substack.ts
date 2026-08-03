/**
 * Backfill or refresh the two Substack publications.
 *
 *   pnpm ingest:substack              # full archive backfill
 *   pnpm ingest:substack --incremental  # only posts we do not already have
 *   pnpm ingest:substack --limit 20
 */
import { prisma } from '@betterman/db';
import { ingestAllSubstack } from '../src/pipeline/run';

const args = process.argv.slice(2);
const incremental = args.includes('--incremental');
const limitFlag = args.indexOf('--limit');
const limit = limitFlag !== -1 ? Number(args[limitFlag + 1]) : undefined;

async function main() {
  const started = Date.now();
  const totals = await ingestAllSubstack({
    incremental,
    limit: Number.isFinite(limit) ? limit : undefined,
    log: (m) => console.log(m),
  });

  console.log(
    `\ndone in ${Math.round((Date.now() - started) / 1000)}s — ` +
      `seen ${totals.seen}, created ${totals.created}, updated ${totals.updated}, skipped ${totals.skipped}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
