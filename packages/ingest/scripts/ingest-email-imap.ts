/**
 * Backfill BetterMornings from a mailbox over IMAP.
 *
 *   pnpm ingest:email-imap
 *   pnpm ingest:email-imap --include-trash   # also read deleted mail
 *   pnpm ingest:email-imap --reparse         # replay through the current parser
 *
 * The public site has no devotional archive, so a mailbox is the only source
 * of history. Ongoing delivery is handled by the hourly poll in the API and by
 * POST /ingest/email — all three share one normalizer, so a devotional cannot
 * parse differently depending on how it arrived.
 *
 * Credentials come from the environment, never the command line, so they do
 * not land in shell history. For Gmail, IMAP_PASSWORD must be an App Password.
 */
import { prisma } from '@betterman/db';
import { ingestFromMailbox, mailboxCredentialsFromEnv } from '../src/email/imap.js';

const args = process.argv.slice(2);

async function main() {
  const credentials = mailboxCredentialsFromEnv();
  if (!credentials) {
    console.error(
      'Missing IMAP credentials. Set IMAP_HOST, IMAP_USER and IMAP_PASSWORD in .env.\n' +
        'For Gmail, IMAP_PASSWORD must be an App Password, not the account password.',
    );
    process.exitCode = 1;
    return;
  }

  const result = await ingestFromMailbox(credentials, {
    includeTrash: args.includes('--include-trash'),
    force: args.includes('--reparse'),
    log: (m) => console.log(m),
  });

  console.log(
    `\nseen ${result.seen}, created ${result.created}, updated ${result.updated}, ` +
      `skipped ${result.skipped}, in review ${result.inReview}`,
  );
  if (result.held.length) console.log(`held for review:\n  ${result.held.join('\n  ')}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
