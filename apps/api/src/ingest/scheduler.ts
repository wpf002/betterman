import { ingestAllSubstack } from '@betterman/ingest';

/**
 * Hourly Substack poll (spec §9).
 *
 * Without this the app only gained new articles when somebody ran a command by
 * hand, which is not a product. The two Substacks are public APIs — no
 * credentials, nobody's mailbox — so this works for any deployment.
 *
 * BetterMornings is not polled, because there is nothing to poll: the
 * devotional exists only as email. It arrives by `POST /ingest/email`, from a
 * mailbox subscribed to the newsletter. Both paths run the same normalizer.
 */

const HOUR_MS = 60 * 60 * 1000;
/** Wait before the first run so a deploy is not immediately doing network I/O. */
const FIRST_RUN_DELAY_MS = 30_000;

export interface Scheduler {
  stop: () => void;
  /** Runs a poll immediately, for the admin "check now" action. */
  runNow: () => Promise<void>;
}

export function startIngestScheduler(log: {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}): Scheduler {
  let running = false;
  let stopped = false;

  const poll = async () => {
    // A slow run must not overlap the next tick; the archive walk is rate
    // limited to ~1 req/sec and can take a while on a cold start.
    if (running || stopped) return;
    running = true;

    try {
      const totals = await ingestAllSubstack({ incremental: true });
      if (totals.created > 0 || totals.updated > 0) {
        log.info(totals, 'substack poll found new work');
      }
    } catch (err) {
      // Never let a failed poll take the API down — reading still works.
      log.error({ err }, 'substack poll failed');
    } finally {
      running = false;
    }
  };

  const first = setTimeout(() => void poll(), FIRST_RUN_DELAY_MS);
  const timer = setInterval(() => void poll(), HOUR_MS);

  log.info({ everyMinutes: HOUR_MS / 60000 }, 'substack poll scheduled');

  return {
    stop: () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
    },
    runNow: poll,
  };
}
