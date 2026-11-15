import { describe, expect, it } from 'vitest';
import { RULES_MVP1, type Rules } from '../rules';
import { addDays } from '../time';
import { buildTimeline, decorLevel, moodOf, stageOf } from '../timeline';
import { type Code, START, fromCodes, repeat, todayAfterClosed } from './helpers';

const R: Rules = RULES_MVP1;
/** Same rules without the starting pass, to look at raw statuses. */
const NO_PASS: Rules = { ...RULES_MVP1, graceInitial: 0 };

function run(codes: readonly Code[], today: string, rules: Rules = R) {
  return { ...buildTimeline(fromCodes(codes), rules, START, today), n: codes.length };
}
/** Statuses of the days described by the codes (days after them are just open/pending). */
const statuses = (t: ReturnType<typeof run>) => t.days.slice(0, t.n).map((d) => d.status);

describe('day status', () => {
  it('2/3 counted, 1/3 logged_low, no row on a closed day missed', () => {
    const t = run(['C2', 'L1', '-'], todayAfterClosed(3), NO_PASS);
    expect(statuses(t)).toEqual(['counted', 'logged_low', 'missed']);
  });

  it('no row on an open day is pending', () => {
    // today = START+2: START and START+1 are today-2 and today-1
    const t = run(['-', '-'], addDays(START, 2), NO_PASS);
    expect(statuses(t)).toEqual(['pending', 'pending']);
    expect(t.days.every((d) => d.provisional)).toBe(true);
  });

  it('today is never judged, and there are no days before the first report', () => {
    expect(run([], START).days).toEqual([]);
    expect(run(['C3'], START).days).toEqual([]); // a row for today is ignored
    const before = buildTimeline(new Map(), R, START, addDays(START, -5));
    expect(before).toMatchObject({ days: [], streak: 0, best: 0, countedTotal: 0, stage: 1, mood: 'calm', passHeld: 1 });
  });

  it('the window is exactly today-1 and today-2', () => {
    const t = run(['-', '-', '-'], addDays(START, 3), NO_PASS);
    expect(statuses(t)).toEqual(['missed', 'pending', 'pending']);
    expect(t.days.map((d) => d.provisional)).toEqual([false, true, true]);
  });
});

describe('rows written during the day (water only)', () => {
  it("yesterday's water-only row is still pending", () => {
    const t = run(['C3', 'W'], addDays(START, 2));
    expect(statuses(t)).toEqual(['counted', 'pending']);
    expect(t.streak).toBe(1);
  });

  it('a water-only row on a closed day is not a check-in', () => {
    const t = run(['W'], todayAfterClosed(1), NO_PASS);
    expect(statuses(t)).toEqual(['missed']);
    expect(t.days[0]?.res).toBeNull();
  });
});

describe('streak', () => {
  it('counts an open day as soon as it is logged, and pending does not break it', () => {
    const today = addDays(START, 5);
    const t = run(['C3', 'C2', 'C3', '-', 'C3'], today); // START+3 = today-2, still open
    expect(statuses(t)).toEqual(['counted', 'counted', 'counted', 'pending', 'counted']);
    expect(t.streak).toBe(4);
    expect(t.countedTotal).toBe(4);
  });

  it('resets on an unprotected miss and remembers the best run', () => {
    const t = run(['C3', 'C3', 'C3', '-', 'C3'], todayAfterClosed(5), NO_PASS);
    expect(t.streak).toBe(1);
    expect(t.best).toBe(3);
  });
});

describe('grace pass', () => {
  it('7 counted then a miss: day 8 graced, streak stays 7, pass spent', () => {
    for (const rules of [R, NO_PASS]) {
      const t = run([...repeat('C3', 7), '-'], todayAfterClosed(8), rules);
      expect(t.days[7]?.status).toBe('graced');
      expect(t.streak).toBe(7);
      expect(t.passHeld).toBe(0);
    }
  });

  it('7 counted, miss, miss: day 8 graced, day 9 missed, streak 0', () => {
    const t = run([...repeat('C3', 7), '-', '-'], todayAfterClosed(9));
    expect(statuses(t).slice(7)).toEqual(['graced', 'missed']);
    expect(t.streak).toBe(0);
    expect(t.best).toBe(7);
  });

  it('14 counted in a row still holds only 1 pass', () => {
    const t = run(repeat('C3', 14), todayAfterClosed(14));
    expect(t.passHeld).toBe(1);
    expect(t.streak).toBe(14);
  });

  it('starts with 1 pass: a missed day 1 is graced', () => {
    const t = run(['-', 'C3', 'C3'], todayAfterClosed(3));
    expect(statuses(t)).toEqual(['graced', 'counted', 'counted']);
    expect(t.passHeld).toBe(0);
    expect(t.streak).toBe(2);
  });

  it('a low day (1/3) is protected the same way as a miss', () => {
    const t = run(['C3', 'L1', 'C3'], todayAfterClosed(3));
    expect(statuses(t)).toEqual(['counted', 'graced', 'counted']);
    expect(t.streak).toBe(2);
    expect(t.countedTotal).toBe(2); // a graced day is not a counted day
  });

  it('a spent pass is earned back on the 7th counted day', () => {
    const t = run(['-', ...repeat('C3', 7), '-', 'C3'], todayAfterClosed(10));
    expect(statuses(t)[0]).toBe('graced');
    expect(statuses(t)[8]).toBe('graced');
    expect(t.streak).toBe(8);
    expect(t.passHeld).toBe(0);
  });

  it('never protects two days in a row, even when holding two passes', () => {
    const two: Rules = { ...RULES_MVP1, graceInitial: 2, graceMax: 2 };
    const t = run(['-', '-', '-'], todayAfterClosed(3), two);
    expect(statuses(t)).toEqual(['graced', 'missed', 'graced']);
    expect(t.passHeld).toBe(0);
  });
});

describe('late rows', () => {
  it('a late 3/3 row never counts: the day stays missed and the streak is 0', () => {
    // pass already spent on day 1
    const t = run(['-', 'C3', 'T3'], todayAfterClosed(3));
    const day = t.days[2];
    expect(day?.status).toBe('missed');
    expect(day?.late).toBe(true);
    expect(day?.res?.passCount).toBe(3); // still shown in History
    expect(t.streak).toBe(0);
    expect(t.countedTotal).toBe(1);
  });

  it('a late row on a day covered by a pass shows as graced, not counted', () => {
    const t = run(['C3', 'T3'], todayAfterClosed(2));
    expect(statuses(t)).toEqual(['counted', 'graced']);
    expect(t.countedTotal).toBe(1);
    expect(t.mood).toBe('tired');
  });
});

describe('provisional results settle when the window closes', () => {
  it('an empty today-2 takes the pass once it closes; today-1 falls back to logged_low', () => {
    const codes: Code[] = ['C3', '-', 'L1'];
    const open = run(codes, addDays(START, 3)); // START+1 = today-2 (open, empty)
    expect(statuses(open)).toEqual(['counted', 'pending', 'graced']);
    expect(open.streak).toBe(1);

    const settled = run(codes, addDays(START, 4)); // START+1 is now closed
    expect(statuses(settled)).toEqual(['counted', 'graced', 'logged_low']);
    expect(settled.streak).toBe(0);
  });
});

describe('stage', () => {
  it.each([
    [0, 1],
    [2, 1],
    [3, 2],
    [9, 2],
    [10, 3],
    [20, 3],
    [21, 4],
    [30, 4],
  ])('%i counted days -> stage %i', (counted, stage) => {
    expect(stageOf(counted, R)).toBe(stage);
  });

  it('does not drop when the streak breaks', () => {
    const t = run([...repeat('C3', 3), '-', '-', '-'], todayAfterClosed(6));
    expect(t.streak).toBe(0);
    expect(t.stage).toBe(2);
  });

  it('a perfect run reaches the adult stage on day 21', () => {
    expect(run(repeat('C3', 20), todayAfterClosed(20)).stage).toBe(3);
    expect(run(repeat('C3', 21), todayAfterClosed(21)).stage).toBe(4);
  });
});

describe('mood', () => {
  it('3/3 happy, 2/3 calm, anything else tired', () => {
    expect(run(['C3'], todayAfterClosed(1)).mood).toBe('happy');
    expect(run(['C2'], todayAfterClosed(1)).mood).toBe('calm');
    expect(run(['L0'], todayAfterClosed(1), NO_PASS).mood).toBe('tired');
    expect(run(['-'], todayAfterClosed(1), NO_PASS).mood).toBe('tired');
    expect(run(['-'], todayAfterClosed(1)).mood).toBe('tired'); // graced
  });

  it('skips pending days and is calm when there is no verdict yet', () => {
    expect(run(['C3', '-'], addDays(START, 2)).mood).toBe('happy');
    expect(run(['-'], addDays(START, 1)).mood).toBe('calm');
    expect(moodOf([])).toBe('calm');
  });
});

describe('decorLevel (game layer)', () => {
  it.each([
    [5, 0],
    [6, 1],
    [13, 1],
    [14, 2],
    [17, 3],
    [24, 3],
    [25, 4],
    [30, 4],
  ])('%i counted days -> level %i', (counted, level) => {
    expect(decorLevel(counted)).toBe(level);
  });
});

describe('input safety', () => {
  it('throws on malformed dates instead of looping', () => {
    expect(() => buildTimeline(new Map(), R, '2026-11-1', '2026-11-11')).toThrow();
    expect(() => buildTimeline(new Map(), R, START, 'today')).toThrow();
  });
});
