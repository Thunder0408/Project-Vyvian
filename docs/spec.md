# Growing With Vyvian — MVP Spec (what to build)

Exported from the "MVP Design Spec" doc (2026-10-25, updated 2026-11-10). Personal
baseline data from that doc is left out of the repo on purpose.
If this file and `docs/build-plan.md` disagree, **build-plan.md wins**.

## Overview

A single-user, mobile-first web app (PWA). The avatar, **Vyvian**, is an **axolotl** that
reacts to one check-in per morning covering three habits: **walk, water, sleep**. The goal of
the first 30 days is consistency, not perfection. "Growing With Vyvian" is a working title.

Everything marked *(hypothesis)* is a design bet that gets judged on day 30.

## Habit rules (rules version `mvp-1`)

Each habit is pass/fail per day. Rules live in code and are frozen for all 30 days.

| Habit | Input | Passes when | Edge cases |
|---|---|---|---|
| Walk | Step count (integer, typed from the phone's health app) | steps ≥ 5,000; on a **Home day** steps ≥ 2,000 | Home day = stayed home all day, didn't go out to work (weekends, holidays, rain). No cap on how often; honour system. |
| Water | ml from quick-add buttons (+780, +600, +550, +250) or typed | ml ≥ 1,400, **no upper limit** | Plain water only — tea, cocoa, soup don't count |
| Sleep | Lights-off time (hh:mm) of the night that ends day D | 19:00 ≤ t ≤ 24:00 | 00:00 counts as 24:00 (pass); 00:01–18:59 fail |

- **Sleep math:** keep raw hh:mm; minutes = hh*60+mm, and if < 720 add 1440. Pass when
  1140 ≤ t ≤ 1440. This avoids the midnight bug of spreadsheet trackers.
- **Which night belongs to which day:** sleep for day D = lights-off on the night of D (even
  if it's 23:40 or 00:00), entered at the next morning's check-in.
- **Home day** *(hypothesis)*: 2,000 steps is still ~15–20 min of deliberate walking. The app
  counts how often it's used, for the day-30 review.
- The metric is **lights-off time**, not time asleep.

## Day result and streak

One check-in per morning records **yesterday (day D)**: final steps, total water, last
night's lights-off. Morning is chosen because the day's steps and sleep are complete.

Status of day D:

1. `counted` — checked in and ≥ 2 of 3 habits pass
2. `logged_low` — checked in, 0–1 pass; breaks the streak but still counts as logged
3. `graced` — no passing check-in, but a grace pass covers it; streak holds, no +1
4. `missed` — none of the above
5. `pending` — back-fill window still open, not checked in yet (see build-plan)

**Streak** = consecutive days back from the latest day with `counted` or `graced`; only
`counted` adds +1.

**Back-fill window:** day D can be entered on time until 23:59 of D+2 (i.e. today-1 and
today-2). Edits inside the window are allowed (typos). After the window, a missed day can
still be logged as **late**: shown in History, but never counts toward streak, stage, grace
or mood. On-time rows can't be edited after their window closes.

**Grace pass** *(hypothesis)*:
- Start with 1 pass. Earn 1 per 7 `counted` days, hold at most 1.
- Applied automatically to a `missed` or `logged_low` day.
- Never covers 2 days in a row — the second day breaks the streak.

**When the streak breaks:** show the best streak and "เริ่มใหม่วันนี้". No penalty to growth.

## Avatar behaviour

Two signals only: **mood** = result of the latest judged day; **growth** = cumulative total.
Growth never goes back, so a bad week doesn't erase the month *(hypothesis: this is what
stops quitting midway)*.

### Mood (latest day with a verdict)

| Latest day | Mood | Vyvian says |
|---|---|---|
| 3/3 | Happy, gills up | "มีความสุขมากเลย ^w^ พลังเต็มเปี่ยม!!!" |
| 2/3 | Calm, okay | "สบายๆ ค่อยๆเป็นค่อยๆไป" |
| 0–1 or no check-in | Tired, resting on the tank floor | "เหนื่อยจัง ขอพักหน่อยน้า ไว้เจอกันพรุ่งนี้ Zzz" |

Lines are Vyvian's own voice: relaxed, cute, friendly, never scolding. No dead, sick or angry
state. After a missed day, the next check-in brings mood back to normal immediately.

### Growth stages (cumulative `counted` days)

| Stage | Unlocks at | Look |
|---|---|---|
| 1 Egg | day 0 | Egg in the tank |
| 2 Hatchling | 3 counted | Small larva |
| 3 Juvenile | 10 counted | Legs and gills |
| 4 Adult | 21 counted | Full axolotl |

Formula (decided 2026-11-10): stage x+1 at `(x + (x+1)) × x` counted days → 3, 10, 21.
A perfect run shows stage 4 on day 21. Home shows "อีก x วันถึงขั้นถัดไป". No items, shop or
levels in the MVP.

**Art:** original simple drawings or SVG per stage and mood (4 stages + mood overlay).

## Screens and check-in flow

Three screens. Target: check-in in **≤ 10 seconds**, measured by the app.

1. **Home** — avatar (stage + mood) in the top half. Below: current streak, best streak,
   grace pass held (0/1), "อีก x วันถึงขั้นถัดไป", and a big "Check-in ของ <เมื่อวาน>" button.
   Once yesterday is in, the button becomes "เสร็จแล้ว เจอกันพรุ่งนี้". A still-open back-fill
   day shows as a small secondary button.
2. **Check-in** (one page, no navigation):
   1. Steps: numeric field with number keypad
   2. Home day: toggle, available every day
   3. Water: +780, +600, +550, +250 and undo; total with a green check at 1,400
   4. Lights-off: time picker
   5. Save; each habit shows pass/fail (✓/✗) live while typing

   After saving, return to Home and play the mood change (≤ 1 s).
3. **History** — 30-day grid coloured by status (counted / graced / logged_low / missed).
   Missed days can be logged late (doesn't count). Tap a day to see its three values. No charts.

**Not in the MVP:** notes, notifications, onboarding, settings other than the water-button ml.

## Intraday logging and game layer (decided 2026-11-10)

The morning check-in is the minimum, not the ceiling: open the app as often as you like. It
should feel like caring for Vyvian, not filling a form.

**Intraday logging**
- Home has a "น้ำวันนี้" bar with quick-add buttons, usable all day; totals go to today's row.
- Today isn't judged. Next morning's check-in closes the day: enter steps and lights-off;
  water is pre-filled from the running total and can be edited before saving.
- A day with water only (never closed) counts as **not checked in**.
- The 10-second check-in metric measures only the morning close.

**Game layer**

| What | Detail |
|---|---|
| Check-in = feeding | 1 food per passing habit; Vyvian swims to eat. 3 foods = happy |
| Tap to play | Tap Vyvian or the water anytime: random poses and lines, no rewards attached |
| Tank changes | Decor appears at 6, 14, 17, 25 counted days (never on a stage-up day); never lost |
| Stage-up scene | Full-screen celebration once per new stage |

Not taken: HP loss or death, coins, shop, choosable items, parties — they break the
no-punishment principle and add decisions. Weekly quests, sound and skins wait for after day 30.

## Out of scope and change freeze

For these 30 days: **no new features and no rule changes, bug fixes only** — otherwise
day 30 can't tell what worked.

Not in the MVP:
- Body / mind / finance categories (post-MVP: finance becomes an in-app "Money Allocate"
  feature, not connected to Google Sheets)
- Notifications, levels, shop, items, avatar customisation
- Automatic step import (a web app can't read Apple Health / Health Connect directly)
- Charts, weekly stats, notes

Change-freeze rules:
- `rules_version` stays `mvp-1` until day 30, including water at 1,400 ml even if it's often missed.
- New ideas go into an "after 30 days" list outside the app, not built now.
- Bug fixes are allowed (wrong calculation, can't save) but rule behaviour must not change.

## Day-30 verdict

The MVP passes when it's used consistently and no features were added. Habit results are
context, not the verdict. All thresholds are hypotheses.

| Metric | Pass | Near | Fail | Data |
|---|---|---|---|---|
| Days with an on-time check-in (back-fill counts, late doesn't) | 30/30 | 24–29 | < 24 | `checkins` |
| No new features | `rules_version` = mvp-1 and no new features | — | added | git history |
| Check-in time (median) | ≤ 10 s | 11–20 s | > 20 s | `duration_ms` |

Day-30 review questions:
- [ ] How often was Home day used — did it feel like cheating or real effort?
- [ ] How often was the grace pass used, and did it really prevent quitting?
- [ ] How much did the avatar bring me back to check in (score 1–5)?
- [ ] Which threshold should move first (e.g. sleep 23:45, or water), and what to add first?
