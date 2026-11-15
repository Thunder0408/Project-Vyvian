// Frozen until day 30 of the trial. Do not edit; bug fixes go elsewhere.

export const RULES_MVP1 = {
  version: 'mvp-1',
  walkMin: 5000,
  walkHomeMin: 2000,
  waterMin: 1400, // no ceiling
  sleepStartMin: 19 * 60, // 19:00
  sleepEndMin: 24 * 60, // 00:00 (midnight), inclusive
  countThreshold: 2, // habits in range needed for a day to count
  graceEvery: 7, // earn a pass every 7 counted days
  graceMax: 1, // hold at most 1
  graceInitial: 1, // start with 1 pass on day one
  // cumulative counted days to reach stage 2, 3, 4: stage x+1 at (x + (x+1)) * x
  stageThresholds: [3, 10, 21],
} as const;

export interface Rules {
  readonly version: string;
  readonly walkMin: number;
  readonly walkHomeMin: number;
  readonly waterMin: number;
  readonly sleepStartMin: number;
  readonly sleepEndMin: number;
  readonly countThreshold: number;
  readonly graceEvery: number;
  readonly graceMax: number;
  readonly graceInitial: number;
  readonly stageThresholds: readonly [number, number, number];
}

/** Game layer only (tank decor). Cumulative counted days; chosen not to collide with stage-ups. */
export const DECOR_THRESHOLDS_MVP1: readonly number[] = [6, 14, 17, 25];
