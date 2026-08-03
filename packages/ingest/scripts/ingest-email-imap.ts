/**
 * Backfill BetterMornings from a mailbox over IMAP.
 *
 *   pnpm ingest:email-imap
 *
 * This is how the historical archive gets in: the public site has no
 * devotional archive (betterman.com/daily-devotional is a signup page), so the
 * mailbox is the only source.
 *
 * Credentials come from the environment — never from the command line, so they
 * do not land in shell history:
 *
 *   IMAP_HOST=imap.gmail.com
 *   IMAP_PORT=993
 *   IMAP_USER=<the subscribed mailbox>
 *   IMAP_PASSWORD=<app password, NOT the account password>
 *
 * For Gmail this needs an App Password (Google Account → Security → 2-Step
 * Verification → App passwords). Generate it yourself and put it in .env; it
 * is never printed or logged here.
 *
 * Runs against the same normalizer as the live webhook, so a backfilled
 * devotional and a delivered one cannot drift apart. Re-running is a no-op.
 */
import { ImapFlow } from 'imapflow';
import { IngestStatus, SourceKey, prisma } from '@betterman/db';
import { BETTERMORNINGS_SENDER } from '../src/email/mime';
import { ingestDevotionalEmail, storeRawPayload } from '../src/pipeline/upsert';
import { finishRun, startRun } from '../src/pipeline/run';

const { IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASSWORD, IMAP_MAILBOX } = process.env;

async function main() {
  if (!IMAP_HOST || !IMAP_USER || !IMAP_PASSWORD) {
    console.error(
      'Missing IMAP credentials. Set IMAP_HOST, IMAP_USER and IMAP_PASSWORD in .env.\n' +
        'For Gmail, IMAP_PASSWORD must be an App Password, not the account password.',
    );
    process.exitCode = 1;
    return;
  }

  const source = await prisma.source.findUniqueOrThrow({
    where: { key: SourceKey.BETTERMORNINGS },
  });

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: Number(IMAP_PORT ?? 993),
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASSWORD },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock(IMAP_MAILBOX ?? 'INBOX');

  const run = await startRun(source.id, 'email-imap-backfill');
  const counters = { seen: 0, created: 0, updated: 0, skipped: 0, inReview: 0 };
  const held: string[] = [];

  try {
    const uids = await client.search({ from: BETTERMORNINGS_SENDER });
    console.log(`${uids ? uids.length : 0} message(s) from ${BETTERMORNINGS_SENDER}`);

    for (const uid of uids || []) {
      const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!message || !message.source) {
        counters.skipped += 1;
        continue;
      }
      counters.seen += 1;

      const raw = message.source.toString('utf8');
      const { parseMime, isBettermorningsEmail } = await import('../src/email/mime');
      const mail = await parseMime(raw);

      if (!isBettermorningsEmail(mail) || !mail.html) {
        counters.skipped += 1;
        continue;
      }

      await storeRawPayload({
        sourceId: source.id,
        runId: run.id,
        kind: 'email-mime',
        externalId: mail.messageId,
        body: raw,
      });

      const result = await ingestDevotionalEmail(source, mail.html, {
        messageId: mail.messageId ?? undefined,
        receivedAt: mail.date ?? undefined,
      });

      if (result.outcome === 'created') counters.created += 1;
      else if (result.outcome === 'updated') counters.updated += 1;
      else counters.skipped += 1;

      if (result.status === 'REVIEW') {
        counters.inReview += 1;
        held.push(`${result.dateKey} (q=${result.parseQuality.toFixed(3)})`);
      }
    }

    await finishRun(run.id, counters, IngestStatus.SUCCESS);
  } catch (err) {
    await finishRun(run.id, counters, IngestStatus.FAILED, String(err));
    throw err;
  } finally {
    lock.release();
    await client.logout();
  }

  console.log(
    `\nseen ${counters.seen}, created ${counters.created}, updated ${counters.updated}, ` +
      `skipped ${counters.skipped}, in review ${counters.inReview}`,
  );
  if (held.length) console.log(`held for review:\n  ${held.join('\n  ')}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
