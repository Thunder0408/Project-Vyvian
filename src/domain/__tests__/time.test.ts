import { describe, expect, it } from 'vitest';
import { addDays, bangkokDateOf, bangkokToday, diffDays, isIsoDate, sleepMinutes } from '../time';

describe('bangkokDateOf', () => {
  it('00:30 Bangkok on 1 Jan is still 31 Dec in UTC, and yesterday is 31 Dec', () => {
    const instant = Date.UTC(2025, 11, 31, 17, 30); // 2026-01-01 00:30 +07
    const today = bangkokDateOf(instant);
    expect(today).toBe('2026-01-01');
    expect(addDays(today, -1)).toBe('2025-12-31');
  });

  it('rolls over exactly at Bangkok midnight (17:00 UTC)', () => {
    expect(bangkokDateOf(Date.UTC(2026, 10, 10, 16, 59, 59, 999))).toBe('2026-11-10');
    expect(bangkokDateOf(Date.UTC(2026, 10, 10, 17, 0, 0, 0))).toBe('2026-11-11');
  });

  it('bangkokToday returns a valid ISO date', () => {
    expect(isIsoDate(bangkokToday())).toBe(true);
  });
});

describe('addDays / diffDays', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-11-11', 0)).toBe('2026-11-11');
    expect(addDays('2026-11-01', 30)).toBe('2026-12-01');
  });

  it('diffDays is b - a', () => {
    expect(diffDays('2026-11-01', '2026-11-30')).toBe(29);
    expect(diffDays('2026-11-30', '2026-11-01')).toBe(-29);
    expect(diffDays('2026-11-11', '2026-11-11')).toBe(0);
  });

  it('rejects malformed or impossible dates instead of guessing', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2026-1-5', '11/11/2026', '', '2026-11-11T00:00:00Z']) {
      expect(isIsoDate(bad)).toBe(false);
      expect(() => addDays(bad, 1)).toThrow();
    }
    expect(() => addDays('2026-11-11', 0.5)).toThrow();
  });
});

describe('sleepMinutes', () => {
  it('puts after-midnight times after the evening', () => {
    expect(sleepMinutes('12:00')).toBe(720);
    expect(sleepMinutes('19:00')).toBe(1140);
    expect(sleepMinutes('23:59')).toBe(1439);
    expect(sleepMinutes('00:00')).toBe(1440);
    expect(sleepMinutes('00:01')).toBe(1441);
    expect(sleepMinutes('11:59')).toBe(2159);
  });

  it('accepts the HH:MM:SS form Postgres returns', () => {
    expect(sleepMinutes('23:40:00')).toBe(1420);
    expect(sleepMinutes('00:00:00')).toBe(1440);
  });

  it('rejects invalid times', () => {
    for (const bad of ['24:00', '7:00', '23:60', 'abc', '']) {
      expect(() => sleepMinutes(bad)).toThrow();
    }
  });
});
