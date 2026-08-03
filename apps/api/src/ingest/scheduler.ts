import {
  ingestAllSubstack,
  ingestFromMailbox,
  mailboxCredentialsFromEnv,
} from '@betterman/ingest';

/**
 * The hourly poll (spec §9).
 *
 * Two sources, two mechanisms, one schedule:
 *
 *   Substack        public archive APIs, no credentials
 *   BetterMornings  the subscribed mailbox over IMAP
 *
 * Without this the app only gained articles when somebody ran a command by
 * hand. Both paths run the same normalizers as the manual backfill and the
 * `POST /ingest/email` webhook, so a piece cannot parse differently depending
 * on how it arrived.
 */

const HOUR_MS = 60 * 60 * 1000;
/** Wait before the first run so a deploy is not immediately doing network I/O. */
const FIRST_RUN_DELAY_MS = 30_000;
/**
 * How far back each poll looks. Generous enough to cover a missed run, a long
 * outage or a weekend, while keeping the hourly cost to a handful of messages
 * rather than the whole mailbox. Re-reading is harmless — ingest is idempotent.
 */
const LOOKBACK_DAYS = 14;

export interface Scheduler {
  stop: () => void;
  /** Runs a poll immediately. */
  runNow: () => Promise<void>;
}

interface Logger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

export function startIngestScheduler(log: Logger): Scheduler {
  let running = false;
  let stopped = false;

  const mailbox = mailboxCredentialsFromEnv();
  if (!mailbox) {
    log.warn(
      {},
      'BetterMornings polling disabled — set IMAP_HOST, IMAP_USER and IMAP_PASSWORD to enable it',
    );
  }

  const pollSubstack = async () => {
    try {
      const totals = await ingestAllSubstack({ incremental: true });
      if (totals.created > 0 || totals.updated > 0) {
        log.info(totals, 'substack poll found new work');
      }
    } catch (err) {
      // A failed poll must never take the API down — reading still works.
      log.error({ err }, 'substack poll failed');
    }
  };

  const pollDevotionals = async () => {
    if (!mailbox) return;
    try {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
      const result = await ingestFromMailbox(mailbox, { since });

      if (result.created > 0 || result.updated > 0) {
        log.info(result, 'devotional poll found new work');
      }
      if (result.held.length > 0) {
        // Held means the parser did not trust its own reading — worth saying
        // out loud rather than leaving to be discovered.
        log.warn({ held: result.held }, 'devotionals held for review');
      }
    } catch (err) {
      // Most likely an expired app password. Say so plainly: the symptom
      // otherwise looks like BetterMan having stopped publishing.
      log.error({ err }, 'devotional poll failed — check IMAP credentials');
    }
  };

  const tick = async () => {
    // A slow run must not overlap the next tick; the archive walk is rate
    // limited to ~1 req/sec and can take a while on a cold start.
    if (running || stopped) return;
    running = true;
    try {
      await pollSubstack();
      await pollDevotionals();
    } finally {
      running = false;
    }
  };

  const first = setTimeout(() => void tick(), FIRST_RUN_DELAY_MS);
  const timer = setInterval(() => void tick(), HOUR_MS);

  log.info(
    { everyMinutes: HOUR_MS / 60000, devotionals: Boolean(mailbox) },
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
