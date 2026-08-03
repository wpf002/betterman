/**
 * Date formatting for archive lists and reading pages.
 *
 * Devotionals and articles need different handling. A devotional's identity is
 * a calendar day — "December 29, 2025" as printed in the email — stored as UTC
 * midnight, so it must be formatted in UTC or it slips a day backwards in
 * Central time. An article has a real publication instant, so it is formatted
 * in BetterMan's own timezone.
 */

const CENTRAL = 'America/Chicago';

/** "December 29, 2025" — from a devotional's yyyy-mm-dd slug. */
export function formatDevotionalDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** "AUG 2" — the short, letterspaced date the Substack skins use. */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CENTRAL,
    month: 'short',
    day: 'numeric',
  })
    .format(date)
    .toUpperCase();
}

/** "August 2, 2026" */
export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CENTRAL,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** ISO yyyy-mm-dd, for <time datetime>. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
