import {
  ingestAllSubstack,
  ingestFromMailbox,
  mailboxCredentialsFromEnv,
} from '@betterman/ingest';

/**
 * The hourly poll (spec §9).
 *
 *   Substack        public archive APIs, no credentials
 *   BetterMornings  the subscribed mailbox over IMAP
 *
 * Both run the same normalizers as the manual backfill and the
 * `POST /ingest/email` webhook, so an article cannot parse differently
 * depending on how it arrived.
 */

const HOUR_MS = 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 15_000;
/**
 * How far back each poll looks. Generous enough to absorb a missed run or an
 * outage; re-reading is harmless because ingest is idempotent.
 */
const LOOKBACK_DAYS = 30;
/**
 * Neither source may stall the schedule. A hung IMAP socket used to leave the
 * run flag set forever, which silently stopped ALL polling — including
 * Substack, which was working fine.
 */
const SOURCE_TIMEOUT_MS = 10 * 60 * 1000;

export interface Scheduler {
  stop: () => void;
  runNow: () => Promise<void>;
}

interface Logger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export function startIngestScheduler(log: Logger): Scheduler {
  let running = false;
  let stopped = false;

  const mailbox = mailboxCredentialsFromEnv();
  if (!mailbox) {
    log.warn(
      {},
      'BetterMornings polling disabled — set IMAP_HOST, IMAP_USER and IMAP_PASSWORD',
    );
  }

  const pollSubstack = async () => {
    const totals = await withTimeout(
      ingestAllSubstack({ incremental: true }),
      SOURCE_TIMEOUT_MS,
      'substack poll',
    );
    // Always report, even a quiet run. A poll that finds nothing and a poll
    // that never happened look identical in the logs otherwise, and that is
    // exactly the confusion that hid a broken devotional poll.
    log.info(totals, 'substack poll complete');
  };

  const pollDevotionals = async () => {
    if (!mailbox) return;

    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const result = await withTimeout(
      ingestFromMailbox(mailbox, { since, includeTrash: true }),
      SOURCE_TIMEOUT_MS,
      'devotional poll',
    );

    log.info({ ...result, since: since.toISOString() }, 'devotional poll complete');

    if (result.held.length > 0) {
      log.warn({ held: result.held }, 'devotionals held for review');
    }
    if (result.seen === 0) {
      // Nothing matched at all. Either the mailbox is empty or the connection
      // is not seeing what we think it is — worth saying rather than assuming.
      log.warn({ mailbox: mailbox.user }, 'devotional poll saw no messages');
    }
  };

  const tick = async () => {
    if (running || stopped) return;
    running = true;

    // Independent, so one source failing or hanging cannot take the other with
    // it — and `running` is released in `finally` regardless.
    const results = await Promise.allSettled([
      pollSubstack().catch((err) => {
        log.error({ err: String(err) }, 'substack poll failed');
        throw err;
      }),
      pollDevotionals().catch((err) => {
        // Most likely an expired app password or a blocked login. Say so:
        // otherwise the symptom looks like BetterMan having stopped publishing.
        log.error({ err: String(err) }, 'devotional poll failed — check IMAP credentials');
        throw err;
      }),
    ]);

    running = false;
    if (results.every((r) => r.status === 'rejected')) {
      log.error({}, 'every ingest source failed this run');
    }
  };

  const first = setTimeout(() => void tick(), FIRST_RUN_DELAY_MS);
  const timer = setInterval(() => void tick(), HOUR_MS);

  log.info(
    { everyMinutes: HOUR_MS / 60000, devotionals: Boolean(mailbox), lookbackDays: LOOKBACK_DAYS },
    'ingest poll scheduled',
  );

  return {
    stop: () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
    },
    runNow: tick,
  };
}
