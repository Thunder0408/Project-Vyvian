# Growing With Vyvian — rules for Claude Code

A single-user, mobile-first habit PWA. Each morning the user closes yesterday with three
values (steps, water, lights-off). Days that pass ≥ 2 of 3 habits are "counted" and grow
**Vyvian**, an axolotl in a tank: egg → hatchling → juvenile → adult. 30-day trial,
rules version **`mvp-1`**, time zone **Asia/Bangkok**.

## Sources of truth (in this order)
1. `docs/build-plan.md` — how to build it AND the latest decisions. If it conflicts with `docs/spec.md`, build-plan.md wins.
2. `docs/spec.md` — product behaviour (rules, screens, avatar) for anything build-plan.md does not cover.
3. `docs/design/` — approved hi-fi designs (not exported yet). UI must match them.
4. `PROGRESS.md` — what to do next. One `[AI]` item per run.
5. `docs/decisions.md` — dated decision log.

## Decisions that override docs/spec.md
- Water: pass when `water_ml >= 1400`. There is NO upper limit (no waterMax).
- Days past the back-fill window can still be logged; the DB sets `late = true` and late rows never count
  toward streak, stage, grace or mood (the day stays missed/graced). On-time rows lock once their window closes.
- Rules live in `src/domain/rules.ts` (`RULES_MVP1`), not in a DB config table. No `grace_events` table; grace is replayed.
- Stage thresholds are cumulative counted days [3, 10, 21] (stage x+1 is reached at (x + (x+1)) * x). `graceInitial = 1`.
- Today may hold a water-only row (logged during the day). A day counts as checked in only when
  `completed_at` is set by the morning check-in.
- Game layer (feeding animation, tap-to-play, tank decor by counted days, stage-up scene) is in scope;
  no HP loss, coins, shop or items.

## Hard rules
- `src/domain/` is pure TypeScript: no React, no Supabase, no `Date` objects across function boundaries.
  Domain files import only from `./…` (`purity.test.ts` enforces it — don't weaken it).
- UI never re-implements a rule; it calls `src/domain/`.
- Dates are `'YYYY-MM-DD'` strings in Asia/Bangkok internally (display is Thai format). Never parse them with `new Date(str)`.
- `RULES_MVP1` is frozen until day 30. Do not edit it or add features; bug fixes only.
- Nothing derived (status, streak, stage, mood…) is stored in the DB.
- The DB trigger owns `completed_at`, `late`, `edit_count`, `created_at`, `updated_at`; the client never computes or sends them as truth.
- Migrations are append-only: never edit `0001_init.sql` once it has run on the real project.
- Never put a secret key (`sb_secret_…`) or DB password in client code or the repo.
- Tests must not call real Supabase or any network service.
- Run `npm test` and `npm run typecheck` (and `npm run build` once it exists) before every commit;
  add a test for every bug fixed in `src/domain/`.
- No red colour in the UI; misses use `--miss`.
- Never push to main. Work on a `claude/` branch and open a pull request.

## Privacy (this repo is on GitHub)
- Never commit personal data: real names, email addresses, health/habit logs, screenshots with
  real data, Supabase project URLs/refs, user UUIDs, keys or passwords.
- Use `.env.local` (gitignored) for real config; commit only `.env.example` with placeholders.
- Test fixtures use fake data only (like `START = '2026-11-01'` and the fake UUIDs in `supabase/tests/`).
- Personal working preferences go in `CLAUDE.local.md` (gitignored), not here.

## Commands
```bash
npm install
npm test             # vitest run
npm run test:watch
npm run typecheck    # tsc --noEmit (strict, noUncheckedIndexedAccess)
PGUSER=postgres ./supabase/tests/run-local.sh   # DB tests on a throwaway local PostgreSQL (never Supabase)
```

## Current state
- Done: `src/domain/` (types, rules, time, evaluate, timeline + tests) and `supabase/migrations/0001_init.sql` + DB tests.
- Not yet: Vite + React app, `src/data/`, UI, PWA, GitHub Actions. See `PROGRESS.md`.

## Key files
| File | Role |
|---|---|
| `src/domain/types.ts` | `Checkin`, `Day`, `Status`, `Timeline`, `Stage`, `Mood` |
| `src/domain/rules.ts` | `RULES_MVP1` (frozen), `DECOR_THRESHOLDS_MVP1` |
| `src/domain/time.ts` | Bangkok dates, `addDays`/`diffDays`, `sleepMinutes` night axis |
| `src/domain/evaluate.ts` | One closed check-in → `DayResult` |
| `src/domain/timeline.ts` | `buildTimeline()` replay; `stageOf`, `moodOf`, `decorLevel` |
| `src/domain/__tests__/helpers.ts` | Day-code DSL (`'C3'`, `'C2'`, `'L1'`, `'L0'`, `'T3'`, `'W'`, `'-'`) |
| `supabase/migrations/0001_init.sql` | Tables, `enforce_checkin_window()` trigger, RLS, grants |
| `supabase/tests/` | Local auth stub + behaviour tests (`local_stub.sql` is never run on Supabase) |

## Project skills
- `vyvian-domain-change` — before touching `src/domain/` or answering how days are judged.
- `vyvian-db-migration` — before any DB / trigger / RLS change or supabase-js write.

## Conventions
- Code comments in English. Domain naming camelCase, DB naming snake_case; only `src/data/` maps between them.
- Tests are named as plain-sentence behaviour (`'7 counted then a miss: day 8 graced…'`).
- UI copy is casual Thai; Vyvian speaks only in speech bubbles. Never "ล้มเหลว", "พลาดเป้า", "เสียดาย".

## Working style
- Before a design choice, give 2–3 options with trade-offs and let the owner decide; explain why, don't change code silently.
- Keep tasks small with a clear "done" check (e.g. "done = `npm test` green + a new test for X").
