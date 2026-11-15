import type { IsoDate } from './types';

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const MS_PER_DAY = 86_400_000;

const bangkokParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Days since 1970-01-01 for a valid ISO date; throws on anything else (e.g. 2026-02-30). */
function toDayNumber(iso: IsoDate): number {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`invalid date: ${iso}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    throw new Error(`invalid date: ${iso}`);
  }
  return ms / MS_PER_DAY;
}

function fromDayNumber(n: number): IsoDate {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}

export function isIsoDate(value: string): value is IsoDate {
  try {
    toDayNumber(value);
    return true;
  } catch {
    return false;
  }
}

/** The Bangkok calendar day that contains the instant `epochMs`. */
export function bangkokDateOf(epochMs: number): IsoDate {
  let y = '';
  let m = '';
  let d = '';
  for (const p of bangkokParts.formatToParts(epochMs)) {
    if (p.type === 'year') y = p.value;
    else if (p.type === 'month') m = p.value;
    else if (p.type === 'day') d = p.value;
  }
  const iso = `${y}-${m}-${d}`;
  toDayNumber(iso); // fail loudly rather than return a malformed date
  return iso;
}

export function bangkokToday(): IsoDate {
  return bangkokDateOf(Date.now());
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  if (!Number.isInteger(n)) throw new Error(`addDays needs a whole number, got ${n}`);
  return fromDayNumber(toDayNumber(iso) + n);
}

/** b - a in whole days. */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return toDayNumber(b) - toDayNumber(a);
}

/**
 * Lights-off time on a "night axis": minutes since noon's midnight, where
 * 12:00..23:59 -> 720..1439 and 00:00..11:59 -> 1440..2159 (after midnight).
 * So 00:00 = 1440 and 00:01 = 1441.
 */
export function sleepMinutes(time: string): number {
  const m = TIME_RE.exec(time);
  if (!m) throw new Error(`invalid time: ${time}`);
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) throw new Error(`invalid time: ${time}`);
  const t = hh * 60 + mm;
  return t < 720 ? t + 1440 : t;
}
