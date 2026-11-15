# Decisions

Log of decisions with dates and reasons. Newest first. Full context lives in
`docs/spec.md` (what) and `docs/build-plan.md` (how).

| Date | Decision | Why |
|---|---|---|
| 2026-11-10 | Intraday water logging: today's row stays open; the morning check-in closes it (`completed_at`). Water-only rows are not check-ins | Make the app feel like caring for Vyvian, not a once-a-day form |
| 2026-11-10 | Game layer in scope: feeding, tap to play, tank decor at 6/14/17/25 counted, stage-up scene. No HP, coins, shop, items | Fun without punishment or extra decisions |
| 2026-11-10 | Stage thresholds [3, 10, 21] from `(x + (x+1)) × x`; start with 1 grace pass | Earlier first reward; a day-1 miss doesn't sting |
| 2026-11-10 | Water has no upper limit | Simpler; the DB 10,000 cap only catches typos |
| 2026-11-10 | Days past the window can be logged as `late` (History only, never counted); on-time rows lock when their window closes | Keep the record complete without letting back-fill farm counts |
| 2026-10-28 | Stack: Vite + React + TS PWA on Vercel + Supabase, no own server | Single user, tiny data; RLS + trigger cover security |
| 2026-10-28 | Rules in code (`RULES_MVP1`), not a DB table; no `grace_events` table | Rule changes visible in git; replay is deterministic |
| 2026-10-28 | Provisional results: open days count for streak/mood as soon as they're logged | Instant reward after the morning check-in |
| 2026-10-28 | Email + password auth, sign-up disabled; no magic link | iOS magic links open in Safari, not the installed PWA |
| 2026-10-28 | Lights-off uses time chips with nothing pre-selected | A default that passes without a tap makes sleep data untrustworthy |
| 2026-10-28 | Publishable key (`sb_publishable_…`) on the client; secret key never in the repo | New Supabase key model |
| 2026-10-25 | MVP spec: 3 habits, counted at ≥ 2/3, back-fill today-1/today-2, grace pass, mood + growth, 30-day change freeze | Consistency over perfection; measure one rule set |

## Open
- After day 30: review with the verdict table in `docs/spec.md`, then decide on `RULES_MVP2`.
- Final name for the app and avatar ("Growing With Vyvian" is a working title).
