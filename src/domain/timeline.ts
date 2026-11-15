import { evaluate, isClosed } from './evaluate';
import { DECOR_THRESHOLDS_MVP1, type Rules } from './rules';
import { addDays, diffDays } from './time';
import type { Checkin, Day, IsoDate, Mood, Stage, Status, Timeline } from './types';

/**
 * Replays raw check-ins from startDate to yesterday and derives everything the
 * user sees. Nothing derived is stored. Today is never judged.
 *
 * A day is "open" (can still be checked in on time) when it is today-1 or today-2.
 */
export function buildTimeline(
  checkins: ReadonlyMap<IsoDate, Checkin>,
  r: Rules,
  startDate: IsoDate,
  today: IsoDate,
): Timeline {
  let pass = r.graceInitial;
  let counted = 0;
  let streak = 0;
  let best = 0;
  let prev: Status | null = null;
  const days: Day[] = [];

  const lastDay = addDays(today, -1);
  const firstOpen = addDays(today, -2);
  const span = diffDays(startDate, lastDay); // throws on malformed dates; < 0 means no days yet

  for (let i = 0; i <= span; i++) {
    const d = addDays(startDate, i);
    const row = checkins.get(d);
    const c = row && isClosed(row) ? row : null; // open rows (water only) are not check-ins
    const open = d >= firstOpen;
    const res = c ? evaluate(c, r) : null;
    const onTime = c !== null && res !== null && !c.late; // late: shown, never counted

    let status: Status = onTime
      ? res.passCount >= r.countThreshold
        ? 'counted'
        : 'logged_low'
      : open
        ? 'pending'
        : 'missed';

    if ((status === 'missed' || status === 'logged_low') && pass > 0 && prev !== 'graced') {
      status = 'graced'; // never two protected days in a row
      pass--;
    }

    if (status === 'counted') {
      counted++;
      streak++;
      if (counted % r.graceEvery === 0) pass = Math.min(r.graceMax, pass + 1);
    } else if (status === 'missed' || status === 'logged_low') {
      streak = 0;
    } // graced, pending: streak unchanged

    best = Math.max(best, streak);
    days.push({ date: d, status, res, late: c?.late ?? false, provisional: open });
    prev = status;
  }

  return {
    days,
    streak,
    best,
    passHeld: pass,
    countedTotal: counted,
    stage: stageOf(counted, r),
    mood: moodOf(days),
  };
}

/** Stage only ever depends on cumulative counted days, so it can never go down. */
export function stageOf(counted: number, r: Rules): Stage {
  const [s2, s3, s4] = r.stageThresholds;
  if (counted >= s4) return 4;
  if (counted >= s3) return 3;
  if (counted >= s2) return 2;
  return 1;
}

/** Mood follows the most recent day that has a verdict (not pending). */
export function moodOf(days: readonly Day[]): Mood {
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i];
    if (!day || day.status === 'pending') continue;
    if (day.status !== 'counted' || !day.res) return 'tired';
    return day.res.passCount === 3 ? 'happy' : 'calm';
  }
  return 'calm'; // no verdict yet: calm egg
}

/** Tank decor level 0..4 from cumulative counted days (game layer). */
export function decorLevel(counted: number, thresholds: readonly number[] = DECOR_THRESHOLDS_MVP1): number {
  return thresholds.filter((t) => counted >= t).length;
}
