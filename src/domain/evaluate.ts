import type { Rules } from './rules';
import { sleepMinutes } from './time';
import type { Checkin, ClosedCheckin, DayResult } from './types';

/** A row counts as a check-in only once the DB has closed it (completed_at set). */
export function isClosed(c: Checkin): c is ClosedCheckin {
  return c.completedAt !== null && c.steps !== null && c.lightsOff !== null;
}

export function evaluate(c: ClosedCheckin, r: Rules): DayResult {
  const walk = c.steps >= (c.homeDay ? r.walkHomeMin : r.walkMin);
  const water = c.waterMl >= r.waterMin;
  const t = sleepMinutes(c.lightsOff);
  const sleep = t >= r.sleepStartMin && t <= r.sleepEndMin;
  const passCount = Number(walk) + Number(water) + Number(sleep);
  return { walk, water, sleep, passCount };
}
