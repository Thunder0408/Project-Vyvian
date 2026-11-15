import { addDays } from '../time';
import type { Checkin, IsoDate } from '../types';

export const START: IsoDate = '2026-11-01';

/**
 * Day codes, one per day starting at START:
 *   'C3' on time 3/3   'C2' on time 2/3   'L1' on time 1/3   'L0' on time 0/3
 *   'T3' late 3/3      'W'  water only (row never closed)     '-'  no row
 */
export type Code = 'C3' | 'C2' | 'L1' | 'L0' | 'T3' | 'W' | '-';

export function closed(date: IsoDate, over: Partial<Checkin> = {}): Checkin {
  return {
    date,
    steps: 6000,
    homeDay: false,
    waterMl: 1500,
    lightsOff: '23:30',
    late: false,
    completedAt: '2026-11-02T01:00:00+00:00',
    ...over,
  };
}

export function fromCodes(codes: readonly Code[], start: IsoDate = START): Map<IsoDate, Checkin> {
  const map = new Map<IsoDate, Checkin>();
  codes.forEach((code, i) => {
    const date = addDays(start, i);
    switch (code) {
      case 'C3':
        map.set(date, closed(date));
        break;
      case 'C2':
        map.set(date, closed(date, { waterMl: 500 }));
        break;
      case 'L1':
        map.set(date, closed(date, { waterMl: 500, steps: 100 }));
        break;
      case 'L0':
        map.set(date, closed(date, { waterMl: 500, steps: 100, lightsOff: '01:30' }));
        break;
      case 'T3':
        map.set(date, closed(date, { late: true }));
        break;
      case 'W':
        map.set(date, closed(date, { steps: null, lightsOff: null, completedAt: null, waterMl: 2000 }));
        break;
      case '-':
        break;
    }
  });
  return map;
}

export function repeat(code: Code, n: number): Code[] {
  return Array.from({ length: n }, () => code);
}

/** `today` such that the first `n` days from START are all closed (window shut). */
export function todayAfterClosed(n: number, start: IsoDate = START): IsoDate {
  return addDays(start, n + 2);
}
