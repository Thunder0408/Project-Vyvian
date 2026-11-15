// Pure domain types. No React, no Supabase, no Date objects across function boundaries.

/** Calendar day in Asia/Bangkok, always 'YYYY-MM-DD'. */
export type IsoDate = string;

/** One row of public.checkins, in domain naming. The data layer maps snake_case to this. */
export interface Checkin {
  date: IsoDate;
  /** null until the day is closed by the morning check-in */
  steps: number | null;
  homeDay: boolean;
  waterMl: number;
  /** 'HH:MM' or 'HH:MM:SS' (Postgres `time`); null until the day is closed */
  lightsOff: string | null;
  /** set by the DB when the day was closed after its back-fill window */
  late: boolean;
  /** DB timestamp string; null = still open (e.g. water logged during the day) */
  completedAt: string | null;
}

/** A check-in the DB has closed: all three values are present. */
export interface ClosedCheckin extends Checkin {
  steps: number;
  lightsOff: string;
  completedAt: string;
}

export interface DayResult {
  walk: boolean;
  water: boolean;
  sleep: boolean;
  /** how many of the three habits are in range (0..3) */
  passCount: number;
}

export type Status =
  | 'counted' // logged on time, >= countThreshold habits in range
  | 'logged_low' // logged on time, below the threshold, no pass available
  | 'graced' // missed or low, covered by a grace pass
  | 'missed' // window closed with no on-time check-in, no pass available
  | 'pending'; // window still open, not checked in yet

export type Mood = 'happy' | 'calm' | 'tired';

/** 1 = egg, 2 = hatchling, 3 = juvenile, 4 = adult */
export type Stage = 1 | 2 | 3 | 4;

export interface Day {
  date: IsoDate;
  status: Status;
  /** habit results of the closed check-in for this day, on time or late; null if none */
  res: DayResult | null;
  /** the day has a late check-in: shown in History, never counted */
  late: boolean;
  /** the back-fill window is still open, so status can still change */
  provisional: boolean;
}

export interface Timeline {
  days: Day[];
  streak: number;
  best: number;
  passHeld: number;
  countedTotal: number;
  stage: Stage;
  mood: Mood;
}
