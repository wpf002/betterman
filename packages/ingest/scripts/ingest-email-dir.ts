/**
 * Backfill BetterMornings from a directory of saved emails.
 *
 *   pnpm ingest:email-dir ./mail
 *
 * Accepts `.eml` (raw MIME) and `.html` (an already-extracted body), which
 * covers both a Gmail Takeout export and anything saved straight out of a
 * mail client. Live delivery goes through POST /ingest/email instead; both
 * paths share the same normalizer, so they cannot drift.
 */
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { IngestStatus, SourceKey, prisma } from '@betterman/db';
import { parseMime } from '../src/email/mime';
import { ingestDevotionalEmail, storeRawPayload } from '../src/pipeline/upsert';
import { finishRun, startRun } from '../src/pipeline/run';

const dir = process.argv[2];

async function main() {
  if (!dir) {
    console.error('usage: pnpm ingest:email-dir <directory of .eml/.html files>');
    process.exitCode = 1;
    return;
  }

  const source = await prisma.source.findUniqueOrThrow({
    where: { key: SourceKey.BETTERMORNINGS },
  });

  const files = (await readdir(dir))
    .filter((f) => ['.eml', '.html', '.htm'].includes(extname(f).toLowerCase()))
    .sort();

  console.log(`${files.length} file(s) in ${dir}`);

  const run = await startRun(source.id, 'email-backfill');
  const counters = { seen: 0, created: 0, updated: 0, skipped: 0, inReview: 0 };

  for (const file of files) {
    counters.seen += 1;
    const raw = await readFile(join(dir, file), 'utf8');

    let html = raw;
    let messageId: string | undefined;
    let receivedAt: Date | undefined;

    if (extname(file).toLowerCase() === '.eml') {
      const mail = await parseMime(raw);
      if (!mail.html) {
        console.log(`  ! ${file}: no HTML part — skipped`);
        counters.skipped += 1;
        continue;
      }
      html = mail.html;
      messageId = mail.messageId ?? undefined;
      receivedAt = mail.date ?? undefined;
    }

    await storeRawPayload({
      sourceId: source.id,
      runId: run.id,
      kind: 'email-mime',
      externalId: messageId ?? file,
      body: raw,
    });

    const result = await ingestDevotionalEmail(source, html, { messageId, receivedAt });
    if (result.outcome === 'created') counters.created += 1;
    else if (result.outcome === 'updated') counters.updated += 1;
    else counters.skipped += 1;
    if (result.status === 'REVIEW') counters.inReview += 1;

    const flag = result.status === 'REVIEW' ? '  [REVIEW]' : '';
    console.log(
      `  ${result.dateKey ?? file} — ${result.outcome} q=${result.parseQuality.toFixed(3)}${flag}`,
    );
  }

  await finishRun(run.id, counters, IngestStatus.SUCCESS);
  console.log(
    `\nseen ${counters.seen}, created ${counters.created}, updated ${counters.updated}, ` +
      `skipped ${counters.skipped}, in review ${counters.inReview}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
