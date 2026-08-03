/**
 * When a notification is allowed to go out.
 *
 * Two rules from spec §10 meet here. Ingest is the trigger, so an unusual send
 * time still notifies — but BetterMornings also respects a reader's chosen
 * delivery hour in their own timezone, defaulting to the email's ~6am CT send.
 */

/** Reads the wall-clock parts of an instant in a given IANA zone. */
export function localParts(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Intl renders midnight as 24 in some locales' hourCycle.
    hour: get('hour') % 24,
    minute: get('minute'),
  };
}

/** The reader's local calendar date, which is what the debounce is keyed on. */
export function localDate(at: Date, timeZone: string): Date {
  const { year, month, day } = localParts(at, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * The UTC instant matching a given local wall-clock hour on a given local day.
 *
 * Derived by probing rather than by adding a fixed offset, because the offset
 * itself depends on the date — a fixed guess lands an hour wrong on either
 * side of a daylight-saving change.
 */
function instantForLocalHour(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  // Start from the naive UTC reading, then correct by the observed difference.
  let guess = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));

  for (let i = 0; i < 3; i += 1) {
    const seen = localParts(guess, timeZone);
    const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    const wantUtc = Date.UTC(year, month - 1, day, hour, 0);
    const drift = wantUtc - seenUtc;
    if (drift === 0) break;
    guess = new Date(guess.getTime() + drift);
  }

  return guess;
}

export interface DeliveryWindow {
  deliverAfter: Date;
  /** The reader's local date, for the once-per-publication-per-day debounce. */
  localDate: Date;
}

/**
 * No notification is sent at or after this local hour. A piece that lands late
 * at night waits for the next morning rather than buzzing a dark bedroom.
 */
export const QUIET_HOUR = 22;

/**
 * Resolves when a piece should reach one reader.
 *
 * `deliverHour` null means "as soon as it lands" — the Substack publications,
 * which have no morning ritual attached.
 *
 * For BetterMornings there are three cases:
 *   - before the chosen hour → wait for it
 *   - after it, during the day → send now, because a Tuesday devotional
 *     delivered on Wednesday is wrong
 *   - after it, but late at night → wait for tomorrow's hour
 */
export function resolveDelivery(
  now: Date,
  timeZone: string,
  deliverHour: number | null,
): DeliveryWindow {
  if (deliverHour === null) {
    return { deliverAfter: now, localDate: localDate(now, timeZone) };
  }

  const hour = Math.max(0, Math.min(23, deliverHour));
  const parts = localParts(now, timeZone);
  const target = instantForLocalHour(parts.year, parts.month, parts.day, hour, timeZone);

  if (target.getTime() > now.getTime()) {
    return { deliverAfter: target, localDate: localDate(target, timeZone) };
  }

  // The hour has passed. Send now unless we are into the quiet hours, in which
  // case hold for the next occurrence. Date.UTC normalizes the month rollover.
  if (parts.hour < QUIET_HOUR) {
    return { deliverAfter: now, localDate: localDate(now, timeZone) };
  }

  const tomorrow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const nextTarget = instantForLocalHour(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    hour,
    timeZone,
  );

  return { deliverAfter: nextTarget, localDate: localDate(nextTarget, timeZone) };
}

/** Falls back to Central when a stored zone is missing or no longer valid. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return 'America/Chicago';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'America/Chicago';
  }
}
