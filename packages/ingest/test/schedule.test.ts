import { describe, expect, it } from 'vitest';
import { localDate, localParts, resolveDelivery, safeTimeZone } from '../src/notify/schedule';

const CHICAGO = 'America/Chicago';
const LONDON = 'Europe/London';
const TOKYO = 'Asia/Tokyo';

/** Reads back the local hour of an instant, to assert on what a reader sees. */
const hourIn = (at: Date, zone: string) => localParts(at, zone).hour;

describe('local time reading', () => {
  it('reports the wall-clock hour in each zone', () => {
    // 2026-08-03T12:00Z — Chicago is UTC-5 in August, Tokyo UTC+9.
    const at = new Date('2026-08-03T12:00:00Z');
    expect(hourIn(at, CHICAGO)).toBe(7);
    expect(hourIn(at, LONDON)).toBe(13);
    expect(hourIn(at, TOKYO)).toBe(21);
  });

  it('renders midnight as hour 0, not 24', () => {
    expect(hourIn(new Date('2026-08-03T05:00:00Z'), CHICAGO)).toBe(0);
  });

  it('keys the local calendar date on the reader, not on UTC', () => {
    // 01:30 UTC on the 4th is still the evening of the 3rd in Chicago.
    const at = new Date('2026-08-04T01:30:00Z');
    expect(localDate(at, CHICAGO).toISOString().slice(0, 10)).toBe('2026-08-03');
    expect(localDate(at, TOKYO).toISOString().slice(0, 10)).toBe('2026-08-04');
  });
});

describe('delivery windows — publications with no set hour', () => {
  it('sends as soon as the piece lands', () => {
    const now = new Date('2026-08-03T18:42:00Z');
    const { deliverAfter } = resolveDelivery(now, CHICAGO, null);
    expect(deliverAfter.toISOString()).toBe(now.toISOString());
  });
});

describe('delivery windows — BetterMornings, across three zones', () => {
  it('holds a devotional that lands before the chosen hour', () => {
    // 08:00Z is 03:00 in Chicago; a 6am reader should wait three hours.
    const now = new Date('2026-08-03T08:00:00Z');
    const { deliverAfter } = resolveDelivery(now, CHICAGO, 6);

    expect(deliverAfter.getTime()).toBeGreaterThan(now.getTime());
    expect(hourIn(deliverAfter, CHICAGO)).toBe(6);
    expect(localDate(deliverAfter, CHICAGO).toISOString().slice(0, 10)).toBe('2026-08-03');
  });

  it('lands at 6am local for a reader in London', () => {
    const now = new Date('2026-08-03T02:00:00Z');
    const { deliverAfter } = resolveDelivery(now, LONDON, 6);
    expect(hourIn(deliverAfter, LONDON)).toBe(6);
  });

  it('lands at 6am local for a reader in Tokyo', () => {
    // 19:00Z on the 2nd is already 04:00 on the 3rd in Tokyo.
    const now = new Date('2026-08-02T19:00:00Z');
    const { deliverAfter } = resolveDelivery(now, TOKYO, 6);
    expect(hourIn(deliverAfter, TOKYO)).toBe(6);
    expect(localDate(deliverAfter, TOKYO).toISOString().slice(0, 10)).toBe('2026-08-03');
  });

  it('sends straight away when the hour has already passed', () => {
    // 15:00Z is 10:00 in Chicago — a devotional that went out late must not be
    // held until tomorrow morning.
    const now = new Date('2026-08-03T15:00:00Z');
    const { deliverAfter } = resolveDelivery(now, CHICAGO, 6);
    expect(deliverAfter.toISOString()).toBe(now.toISOString());
  });

  it('is exact on the day the clocks go forward', () => {
    // US DST begins 2026-03-08. Chicago jumps from 02:00 to 03:00 local, so a
    // fixed UTC offset would put a 6am delivery an hour out.
    const now = new Date('2026-03-08T06:00:00Z'); // 00:00 CST
    const { deliverAfter } = resolveDelivery(now, CHICAGO, 6);
    expect(hourIn(deliverAfter, CHICAGO)).toBe(6);
  });

  it('is exact on the day the clocks go back', () => {
    // US DST ends 2026-11-01, so this instant is 23:00 on Oct 31 CDT and the
    // 6am target falls on the 55-minute-longer day that follows.
    const now = new Date('2026-11-01T04:00:00Z');
    const { deliverAfter } = resolveDelivery(now, CHICAGO, 6);
    expect(hourIn(deliverAfter, CHICAGO)).toBe(6);
    expect(localDate(deliverAfter, CHICAGO).toISOString().slice(0, 10)).toBe('2026-11-01');
  });

  it('holds a late-night arrival until the next morning', () => {
    // 23:30 local. The hour has passed, but nobody wants this at 11:30pm.
    const now = new Date('2026-08-04T04:30:00Z');
    expect(hourIn(now, CHICAGO)).toBe(23);

    const { deliverAfter, localDate: day } = resolveDelivery(now, CHICAGO, 6);
    expect(deliverAfter.getTime()).toBeGreaterThan(now.getTime());
    expect(hourIn(deliverAfter, CHICAGO)).toBe(6);
    // Tomorrow, not tonight.
    expect(day.toISOString().slice(0, 10)).toBe('2026-08-04');
  });

  it('rolls into the next month cleanly at a month boundary', () => {
    // 23:30 on Aug 31 in Chicago.
    const now = new Date('2026-09-01T04:30:00Z');
    const { deliverAfter } = resolveDelivery(now, CHICAGO, 6);
    expect(hourIn(deliverAfter, CHICAGO)).toBe(6);
    expect(localDate(deliverAfter, CHICAGO).toISOString().slice(0, 10)).toBe('2026-09-01');
  });

  it('clamps an out-of-range hour rather than drifting into another day', () => {
    const now = new Date('2026-08-03T08:00:00Z');
    expect(hourIn(resolveDelivery(now, CHICAGO, 30).deliverAfter, CHICAGO)).toBe(23);
    expect(resolveDelivery(now, CHICAGO, -5).deliverAfter.getTime()).toBeLessThanOrEqual(
      now.getTime(),
    );
  });
});

describe('timezone fallback', () => {
  it('falls back to Central for a missing or invalid zone', () => {
    expect(safeTimeZone(null)).toBe('America/Chicago');
    expect(safeTimeZone('')).toBe('America/Chicago');
    expect(safeTimeZone('Mars/Olympus_Mons')).toBe('America/Chicago');
  });

  it('keeps a valid zone', () => {
    expect(safeTimeZone(TOKYO)).toBe(TOKYO);
  });
});
