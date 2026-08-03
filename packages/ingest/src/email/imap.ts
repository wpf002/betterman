import { ImapFlow, type ListResponse } from 'imapflow';
import { IngestStatus, SourceKey, prisma } from '@betterman/db';
import { BETTERMORNINGS_SENDER, isBettermorningsEmail, parseMime } from './mime.js';
import { ingestDevotionalEmail, storeRawPayload } from '../pipeline/upsert.js';
import { finishRun, startRun } from '../pipeline/run.js';

/**
 * Reading BetterMornings out of a mailbox.
 *
 * Extracted from the backfill script so the hourly scheduler can run the same
 * code. A devotional arriving by webhook, by manual backfill, or by scheduled
 * poll goes through one normalizer — three paths that parse differently is
 * three sets of bugs.
 */

export interface MailboxCredentials {
  host: string;
  port?: number;
  user: string;
  password: string;
  /** Explicit mailbox list. Defaults to the account's "all mail" folder. */
  mailbox?: string;
}

export interface MailboxIngestOptions {
  /** Also read deleted mail. Off by default — deleting is a decision. */
  includeTrash?: boolean;
  /** Rewrite rows we already have, replaying them through the current parser. */
  force?: boolean;
  /**
   * Only look at mail newer than this. The scheduled poll uses a short window
   * so it does not re-read the whole archive every hour; a backfill omits it.
   */
  since?: Date;
  log?: (message: string) => void;
}

export interface MailboxIngestResult {
  seen: number;
  created: number;
  updated: number;
  skipped: number;
  inReview: number;
  held: string[];
}

/** Credentials from the environment, or null when none are configured. */
export function mailboxCredentialsFromEnv(): MailboxCredentials | null {
  const { IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASSWORD, IMAP_MAILBOX } = process.env;
  if (!IMAP_HOST || !IMAP_USER || !IMAP_PASSWORD) return null;

  return {
    host: IMAP_HOST,
    port: IMAP_PORT ? Number(IMAP_PORT) : 993,
    user: IMAP_USER,
    password: IMAP_PASSWORD,
    mailbox: IMAP_MAILBOX || undefined,
  };
}

function resolveMailboxes(
  boxes: ListResponse[],
  explicit: string | undefined,
  includeTrash: boolean,
): string[] {
  if (explicit) return [explicit];

  // Gmail's INBOX holds only unfiled mail — archiving removes a message from
  // it — so the "all mail" folder is the one worth reading.
  const all =
    boxes.find((b) => b.specialUse === '\\All')?.path ??
    boxes.find((b) => /all mail/i.test(b.path))?.path ??
    'INBOX';

  if (!includeTrash) return [all];

  const trash =
    boxes.find((b) => b.specialUse === '\\Trash')?.path ??
    boxes.find((b) => /trash/i.test(b.path))?.path;

  return trash ? [all, trash] : [all];
}

export async function ingestFromMailbox(
  credentials: MailboxCredentials,
  options: MailboxIngestOptions = {},
): Promise<MailboxIngestResult> {
  const log = options.log ?? (() => {});
  const result: MailboxIngestResult = {
    seen: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    inReview: 0,
    held: [],
  };

  const source = await prisma.source.findUniqueOrThrow({
    where: { key: SourceKey.BETTERMORNINGS },
  });

  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port ?? 993,
    secure: true,
    // Google shows app passwords in "abcd efgh ijkl mnop" groups; the spaces
    // are presentational and must not be sent.
    auth: { user: credentials.user, pass: credentials.password.replace(/\s+/g, '') },
    logger: false,
  });

  await client.connect();

  const run = await startRun(source.id, options.since ? 'email-imap-poll' : 'email-imap-backfill');

  try {
    const mailboxes = resolveMailboxes(
      await client.list(),
      credentials.mailbox,
      Boolean(options.includeTrash),
    );
    log(`mailboxes: ${mailboxes.join(', ')}`);

    for (const mailbox of mailboxes) {
      const lock = await client.getMailboxLock(mailbox);
      try {
        // `search` returns SEQUENCE numbers unless uid:true is passed; feeding
        // those to a uid-based fetch matches nothing, silently.
        const uids = await client.search(
          {
            from: BETTERMORNINGS_SENDER,
            ...(options.since ? { since: options.since } : {}),
          },
          { uid: true },
        );
        log(`  ${mailbox}: ${uids ? uids.length : 0} message(s)`);

        for (const uid of uids || []) {
          const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!message || !message.source) {
            result.skipped += 1;
            continue;
          }
          result.seen += 1;

          const raw = message.source.toString('utf8');
          const mail = await parseMime(raw);

          if (!isBettermorningsEmail(mail) || !mail.html) {
            result.skipped += 1;
            continue;
          }

          await storeRawPayload({
            sourceId: source.id,
            runId: run.id,
            kind: 'email-mime',
            externalId: mail.messageId,
            body: raw,
          });

          const outcome = await ingestDevotionalEmail(source, mail.html, {
            messageId: mail.messageId ?? undefined,
            receivedAt: mail.date ?? undefined,
            force: options.force,
          });

          if (outcome.outcome === 'created') result.created += 1;
          else if (outcome.outcome === 'updated') result.updated += 1;
          else result.skipped += 1;

          if (outcome.status === 'REVIEW') {
            result.inReview += 1;
            result.held.push(`${outcome.dateKey} (q=${outcome.parseQuality.toFixed(3)})`);
          }
        }
      } finally {
        lock.release();
      }
    }

    await finishRun(run.id, result, IngestStatus.SUCCESS);
    return result;
  } catch (err) {
    await finishRun(run.id, result, IngestStatus.FAILED, String(err));
    throw err;
  } finally {
    await client.logout().catch(() => undefined);
  }
}
