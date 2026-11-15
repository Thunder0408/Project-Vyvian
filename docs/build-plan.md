# Growing With Vyvian — Build Plan (how to build it)

Exported from the "แผนพัฒนา (Frontend · Backend · UX/UI)" doc (2026-10-28, updated
2026-11-10). **This file wins over `docs/spec.md`** where they disagree. No rule behaviour
from the spec is changed here.

**Summary:** Vite + React + TypeScript PWA on Vercel + Supabase (Postgres, Auth, RLS), with
no server of our own. All logic (day status, streak, grace, mood, stage) is pure client-side
functions recomputed from raw values every time. The DB only stores raw values and enforces
correctness.

## Decisions that differ from the spec

| # | Topic | Spec said | Decided | Why |
|---|---|---|---|---|
| 1 | Where rules live | `config` table in DB | Constants in `src/domain/rules.ts` + `rules_version` on every row | Rule changes need a git commit, so "no rule changes" is checkable from history and can't be changed from a dashboard |
| 2 | `grace_events` table | Store to avoid double-use | Not created; grace is replayed from raw rows in date order | Replay is deterministic; a second table would be duplicate data that can disagree |
| 3 | "Latest closed day" | Not defined | Streak and mood include days still inside the back-fill window if checked in (provisional) | Otherwise this morning's check-in wouldn't move the streak for 2 days, killing the instant reward |
| 4 | Login | Not specified | Email + password via Supabase Auth, sign-up disabled after creating the account | On iOS, magic links open in Safari, not the home-screen PWA, so the session lands in the wrong place |
| 5 | Lights-off default | 23:30 | Time chips (last night's value, 23:00, 00:00, custom), nothing pre-selected — one tap required | A value that passes without a tap makes sleep data untrustworthy |
| 6 | Types | `date` PK, `lights_off` text | PK `(user_id, date)`, `lights_off` is `time` | RLS needs an owner column; `time` lets the DB validate format |
| 7 | API key | anon key | Publishable key (`sb_publishable_…`) | Supabase no longer issues anon keys to new projects |

**Test devices:** an Android phone is primary (Chrome → Install app / Add to Home screen);
an iPad is secondary (Safari → Share → Add to Home Screen, then log in *inside* the installed
app — its storage is separate from Safari). Both share data through Supabase. Steps are still
typed in from the phone's health app.

## Architecture and stack

Two pieces only: a PWA (static files on Vercel) talking straight to Supabase via
supabase-js. No API server in between — single user, under a hundred rows, and RLS +
a Postgres trigger cover all the security rules.

```
[PWA on Vercel]                      [Supabase]
  React UI                ───────►     Auth (email + password)
  src/domain/ (pure fns)               Postgres: checkins, settings
  service worker (UI cache)            RLS + trigger enforce the back-fill window
        ▲
        │ auto-deploy from GitHub main
```

| Layer | Chosen | Not chosen, and why |
|---|---|---|
| Build | Vite + React + TypeScript | Next.js: no need for SSR or API routes |
| Routing | react-router (4 routes) | Hand-rolled state routing: Android back button breaks |
| State / data | React state + small hooks; load all check-ins once on open | TanStack Query / Redux: data too small to justify |
| Styling | Plain CSS + CSS variables (design tokens) | UI kits: generic look, theme would be rebuilt anyway |
| PWA | vite-plugin-pwa (manifest + service worker) | Hand-written SW: stale-cache bugs |
| Backend | Supabase: Postgres + Auth + RLS | Firebase: NoSQL, and a Supabase account already exists |
| Test | Vitest for `src/domain/` | Playwright E2E: not worth it in the MVP; use the mobile checklist |
| Hosting | Vercel (Hobby) + GitHub | — |

Package versions: latest stable at install time, pinned by the lockfile.

**Principles that must not be broken:** `src/domain/` never imports React or Supabase, so
every rule is testable without UI or DB; the UI never computes a rule itself — it always
goes through `src/domain/`.

## Backend (Supabase)

Two tables, RLS on both, and one trigger that enforces the back-fill window on the DB side,
so nobody can back-date from the dashboard or a raw request. No Edge Functions.
The schema is `supabase/migrations/0001_init.sql` (already merged with the 2026-11-10
intraday-logging changes).

### `public.checkins` — one row per user per reported day D

| Column | Notes |
|---|---|
| `user_id`, `date` | Primary key. `date` = reported day D (Bangkok). Immutable |
| `steps` | 0–100,000. `null` until the day is closed |
| `home_day` | Lowers the walk target to 2,000; counted for the review |
| `water_ml` | 0–10,000 (cap only catches typos), default 0; topped up during the day |
| `lights_off` | `time`, `< 24:00`; `null` until closed. 00:00 = midnight |
| `rules_version` | `'mvp-1'` |
| `duration_ms` | Time from opening check-in to Save; recorded on the first close only |
| `edit_count` | Edits after the day was closed (trigger-owned) |
| `late` | Closed after the window → never counts (trigger-owned) |
| `completed_at` | Set when the day closes; a day is "checked in" only when this is set (trigger-owned) |
| `created_at`, `updated_at` | Trigger-owned |

Constraint `checkins_closed_has_values`: a closed row must keep `steps` and `lights_off`.

### `public.settings` — one row per user

`start_date` (first day D of the trial) and `water_buttons` (default `{780,600,550,250}`).

### Trigger `enforce_checkin_window()` (before insert/update)

1. Reject `date > today` (Bangkok).
2. On update: `date` / `user_id` immutable; an **on-time** closed row older than today-2 is
   locked. Late rows stay editable.
3. Already closed → freeze `completed_at`, `late`, `duration_ms`; `edit_count + 1`.
4. Else, when steps + lights_off are present and `date < today` → close it:
   `completed_at = now()`, `late = date < today - 2` (decided at close time, not insert time).
5. Else → still open (water-only, or today). Today is never closed.

Whatever the client sends for trigger-owned columns is ignored.

**Client save:** one upsert on `(user_id, date)` per Save. A day past the window can still
be saved — the DB sets `late = true`. The check-in page shows a banner beforehand:
"เลยช่วงกรอกย้อนหลังแล้ว สามารถบันทึกได้ แต่จะไม่นับ streak" instead of refusing.

### Auth

- Create the single account from the Supabase Dashboard (Authentication → Add user, auto-confirm).
- Turn off "Allow new users to sign up" immediately — the publishable key is in client code.
- Log in once with email + password inside the installed app; supabase-js keeps the
  session and refresh token.

### Keys

| Key | Where |
|---|---|
| `sb_publishable_…` | Client env `VITE_SUPABASE_PUBLISHABLE_KEY` — same rights as the old anon key |
| `sb_secret_…` | **Never** in client code or the repo. Only as a GitHub Actions secret, if backups are set up |

### Free-plan risks (handle before day 1)

| Risk | Effect on the trial | Mitigation |
|---|---|---|
| Project pauses after 7 days idle | Coming back after a week, the app won't open — exactly when returning should be easiest | GitHub Actions cron hits the REST API every 3 days (verify after setup) |
| No automatic backup | 30 days of data is the evidence; can't lose it | Weekly GitHub Action `supabase db dump --data-only` as an artifact (DB password as a secret) |
| 2 active projects max | Can't create a new one if 2 exist | Check the dashboard first, or reuse a project with a separate schema |

## Domain logic (the heart of the app)

Everything the user sees comes from one function, `buildTimeline()`, which replays raw rows
from `start_date` to yesterday. Nothing computed is stored.

**Time (the most bug-prone part):**
- All dates are `YYYY-MM-DD` strings in Thai time. Never pass `Date` objects between
  functions. Display uses Thai format (e.g. "อ. 27 ต.ค.").
- `addDays` goes through `Date.UTC`; never `new Date('2026-10-28')` read as local time.
- Lights-off: t = hh*60+mm; if t < 720, t += 1440; pass when 1140 ≤ t ≤ 1440.
- `Intl.DateTimeFormat('th-TH')` defaults to the Buddhist year — decide BE vs CE before showing years.

**Replay:**
- Day D is *open* when D = today-1 or today-2, *closed* when D ≤ today-3.
- Only rows with `completed_at` set are check-ins; today is never in the loop.
- An open day with no check-in = `pending`: no break, no +1.
- An open day with a check-in is evaluated immediately, including provisional grace. Final
  results match once the window closes, except one rare case: if today-2 is still empty and
  becomes `missed`, the pass goes to it first, and today-1 shown as `graced` falls back to
  `logged_low`. Accepted — rare and matches the spec.
- `moodOf`: latest non-pending day → 3/3 happy, 2/3 calm, anything else (incl. graced,
  missed) tired; no days yet → calm egg.
- `stageOf`: cumulative counted (incl. open days) vs [3, 10, 21]; never goes down.
- `decorLevel(counted)`: thresholds 6, 14, 17, 25.
- Late rows count toward nothing; the day stays missed/graced but values show in History.

**Test cases that must pass before any UI** (all implemented in `src/domain/__tests__/`):

| Group | Cases | Expected |
|---|---|---|
| Sleep | 00:00 / 00:01 / 18:59 / 19:00 / 23:59 / 11:59 / 12:00 | pass / fail / fail / pass / pass / fail / fail |
| Water | 1,399 / 1,400 / 2,971 / 5,000 | fail / pass / pass / pass |
| Walk | 4,999 / 5,000 normal; 1,999 / 2,000 Home day | fail / pass; fail / pass |
| Status | 2/3 / 1/3 / no row on closed day / no row on open day | counted / logged_low / missed / pending |
| Grace | 7 counted then missed | day 8 graced, streak 7, pass 0 |
| Grace | 7 counted, missed, missed | day 8 graced, day 9 missed, streak 0 |
| Grace | 14 counted in a row | holds only 1 pass |
| Stage | cumulative 2 / 3 / 10 / 21 | stage 1 / 2 / 3 / 4, never drops on a streak break |
| Time | today = 2026-01-01 00:30 Bangkok (still 2025-12-31 UTC) | yesterday = 2025-12-31 |
| Intraday | yesterday water-only / day 1 missed / closed 3 days late | pending / graced (starting pass) / late |

## Frontend

After login, load all `checkins` and `settings` once and compute the `Timeline` in memory.
Every screen reads the same `Timeline`. ~30 rows → no cache layer.

### Project structure

```
vyvian/
├─ CLAUDE.md
├─ PROGRESS.md
├─ docs/                      spec.md, build-plan.md, decisions.md, design/
├─ supabase/migrations/0001_init.sql
├─ .github/workflows/         keepalive.yml, backup.yml
├─ public/                    icons 192/512, apple-touch-icon
└─ src/
   ├─ domain/                 pure functions — no React/Supabase
   │  ├─ rules.ts  time.ts  evaluate.ts  timeline.ts  types.ts
   │  └─ __tests__/
   ├─ data/                   the only place that talks to Supabase
   │  ├─ client.ts            createClient(url, publishableKey)
   │  ├─ checkins.ts          list(), upsert()
   │  └─ settings.ts          get(), create()
   ├─ app/                    AppProvider: session + checkins + timeline
   ├─ features/
   │  ├─ auth/LoginPage.tsx
   │  ├─ home/HomePage.tsx
   │  ├─ checkin/CheckinSheet.tsx
   │  └─ history/HistoryPage.tsx
   ├─ avatar/                 Vyvian.tsx + SVG per stage
   └─ styles/tokens.css  global.css
```

### Routes

| Route | Page | When |
|---|---|---|
| `/login` | Login | No session |
| `/setup` | Notice that start date isn't set (no form) | Session but no `settings` row |
| `/` | Home | Normal |
| `/checkin/:date` | Check-in (full-screen sheet) | Open day = counted save; past window (≥ start_date) = late save; today/future → redirect `/` |
| `/history` | History | Normal |

Vercel needs a rewrite of every path to `index.html` (`vercel.json`), or refreshing
`/history` 404s. No setup form (spec has no onboarding): insert the `settings` row once by
SQL in Supabase.

### Save flow

1. The form saves a draft to `localStorage` on every change (survives lost network / closed app).
2. Save → upsert with `rules_version` and `duration_ms`.
3. Success → update `checkins` in state, recompute the Timeline, clear the draft, back to
   Home with the mood transition.
4. Failure → keep the form, show a human message and a retry button. No offline queue in the MVP.

### PWA

- vite-plugin-pwa manifest: name "Growing With Vyvian", `display: standalone`, theme colour
  from the tank, icons 192 and 512 px (+ maskable).
- Service worker precaches app files only; Supabase API is not cached (no stale data).
- `registerType: 'autoUpdate'` — nothing is lost by a reload except the form, which has a draft.
- Self-host fonts via `@fontsource/*` (check package names at install).

## UX/UI

Tone: **"a warm fish tank in the morning"**. Vyvian is the hero in the top half; numbers and
buttons sit in the bottom half within thumb reach. **No red anywhere** — the spec forbids
feeling punished; missed days use light grey.

### Design tokens (starting point — check contrast on device, target 4.5:1)

```css
:root {
  --bg: #F3F8F8;        --surface: #FFFFFF;     --text: #1E2B30;   --text-muted: #5E6F75;
  --tank-top: #D4F1F0;  --tank-bottom: #8FCFD6;  --sand: #EADBC0;
  --vyvian: #F5A9C3;    --vyvian-gill: #E06890;
  --ok: #2F9C6E;        /* pass / counted */
  --low: #D9A441;       /* logged_low */
  --grace: #9C8FDB;     /* graced */
  --miss: #C3CCD0;      /* missed: grey, not red */
  --primary: #157A86;   --on-primary: #FFFFFF;
  --radius: 16px;       --tap: 48px;   /* buttons at least 48px tall */
}
@media (prefers-color-scheme: dark) { :root {
  --bg: #0D1B20; --surface: #15262C; --text: #E6F0F2; --text-muted: #9DB0B5;
  --tank-top: #16404A; --tank-bottom: #0B2A31; --sand: #3A3528;
  --primary: #4FB8C4; --on-primary: #08262B; --miss: #4A5A60;
} }
```

| Use | Font | Why |
|---|---|---|
| UI, numbers | Noto Sans Thai (`font-variant-numeric: tabular-nums`) | Readable; numbers don't jump |
| Vyvian's speech | Mali | Rounded, friendly; speech bubbles only |

### Screens

**Home** — date + "วันที่ 4/30"; tank ~55% of the screen with a speech bubble and Vyvian on
sand; three equal cells "Streak · ดีสุด · Pass 0/1"; "อีก x วัน Vyvian จะโตขึ้น"; main button
"Check-in ของเมื่อวาน (อ.)" 56px tall; "ยังกรอกของวัน… ได้ ›" when today-2 is empty; bottom
nav Home / History. Once yesterday is in, the main button becomes a disabled
"เสร็จแล้ว เจอกันพรุ่งนี้" with a small "แก้ไข" link while still in the window.

**Check-in** (full-screen sheet sliding up):
- Steps: `inputmode="numeric"`, `enterkeyhint="next"`; Home day toggle beside it showing
  the target (5,000 / 2,000).
- Water: progress bar to 1,400, quick-add buttons and undo. No ceiling (DB still caps 10,000).
- Lights-off: time chips, nothing pre-selected.
- Each habit shows icon **and** word (✓ ผ่าน / ยังไม่ถึง) — never colour alone.
- Sticky Save summarises the result first ("ผ่าน 2/3 · นับ streak" or "ผ่าน 1/3 · Vyvian
  จะพักก่อน"), disabled until all three fields are filled.
- 10-second budget: steps ~4 s, water 2–3 taps ~3 s, same time 0 s, save ~1 s (estimate —
  measure with `duration_ms`).

**History** — 5-week Mon–Sun grid. Legend: ● counted ◆ graced ◐ low ○ missed ◌ still open.
Tap a cell → bottom sheet with the three values + ✓/✗ and "แก้ไข" while in the window.
Missed days past the window get "บันทึกย้อนหลัง (ไม่นับ streak)"; late rows show ○ with a
small dot and a "บันทึกย้อนหลัง · ไม่นับ" label.

### Vyvian (avatar)

- 4 SVG files (egg, hatchling, juvenile, adult), each with groups `#body #gills
  #eyes-open #eyes-closed`; switch mood with a `data-mood` attribute + CSS instead of 12 drawings.

| Mood | Pose | Animation |
|---|---|---|
| happy | Gills up, floating mid-tank | Bob 3 s/cycle, bubbles |
| calm | Normal gills, floating low | Slow bob 5 s/cycle |
| tired | Lying on sand, eyes closed | Slow breathing + rising "Zzz" |

- Mood change after saving: ≤ 1 s transition. Stage-up: one longer 2 s transition (optional).
- `prefers-reduced-motion`: no floating or bubbles, static pose.
- Art must be original. Claude Code drafts simple SVGs first; they can be swapped for
  hand-drawn art without touching other code.

### Microcopy

All Thai, casual. Vyvian speaks only in bubbles; UI text is short and direct. Never use
"ล้มเหลว", "พลาดเป้า", "เสียดาย". Technical errors say what to do next, e.g.
"บันทึกไม่สำเร็จ เน็ตอาจหลุด ข้อมูลยังอยู่ ลองอีกครั้ง".

### Game layer (decided 2026-11-10)

Goal: opening the app feels like caring for Vyvian. Estimate 8–14 h extra; if short on
time, cut from the bottom up.

| # | What | How |
|---|---|---|
| 1 | Feeding on save | 1 food per passing habit falls into the tank, Vyvian swims to eat (CSS keyframes, ≤ 2 s, tap to skip) |
| 2 | Today's water bar on Home | Quick-add buttons update today's row; bar moves instantly |
| 3 | Tap to play | Tap Vyvian → 1 of 3–4 random poses; tap water → bubbles; random lines per mood |
| 4 | Tank decor by counted | `decorLevel(counted)` in `src/domain/`, thresholds 6, 14, 17, 25 |
| 5 | Stage-up scene | Full screen once per stage; remember "shown" in `localStorage` |
| 6 | Light vibration | `navigator.vibrate` on water and save (Android Chrome only — never rely on it) |

Every animation stops under `prefers-reduced-motion` and must never slow the morning close:
`duration_ms` stops at the Save tap.

## Milestones

Domain + tests must be done before any UI — it's the only part where a bug makes day 30
unreadable. Live status is in `PROGRESS.md`.

| # | Work | After | Est. hours | Done when |
|---|---|---|---|---|
| 1 | Setup: repo, Vite + React + TS, Supabase project, run migration, account, disable sign-up, settings row | — | 2–3 | Log in from localhost; select sees only own settings row |
| 2 | Domain + tests: rules, time, evaluate, timeline | 1 | 4–6 | Every test case above passes in Vitest |
| 2b | Draft Vyvian SVGs (4 stages) | 1 | 3–6 | Can run in parallel; cap the time |
| 2c | Hi-fi designs: Home, Check-in, History, light + dark | 1 | 3–5 | Approved; exported to `docs/design/` |
| 2d | UI foundation: tokens, fonts, layout shell, bottom nav | 2c | 2–3 | Matches `docs/design/` |
| 3 | Data layer + trigger checks | 2 | 2–3 | Out-of-window insert gets late/refused as designed; in-window insert succeeds |
| 4 | Check-in screen: form, draft, upsert, `duration_ms` | 3, 2d | 4–6 | 3 real check-ins on Android in ≤ 10 s each |
| 5 | Home + Vyvian: 4 stages × 3 moods, streak, pass, CTA | 4, 2b | 3–5 | 10 days of mock data match `buildTimeline` |
| 6 | History: 5-week grid + day detail | 5 | 2–4 | Every status shows the right icon and colour |
| 7 | PWA + deploy + GitHub Actions | 6 | 3–5 | Mobile checklist passes; keep-alive and backup ran once |
| 8 | Dry run 2–3 days + mobile checklist | 7 | ~1 | Delete rehearsal rows, then set `start_date` |
| 9 | 30-day trial (change freeze) | 8 | ~10 s/day | Bug fixes only |
| 10 | Day-30 review | 9 | 1–2 | Use the verdict table in `docs/spec.md` before adding anything |

If time runs short, cut the art first (simple SVGs can be swapped later) — never skip 2 or 7.

## Running milestones as a scheduled cloud task (optional)

Claude Code on the web does **one small milestone item per run**, opens a PR and stops; the
owner reviews and merges in the evening.

One-time setup (by the owner):
1. This repo has `CLAUDE.md`, `PROGRESS.md`, `docs/spec.md`, `docs/build-plan.md`
   (cloud runs can't read Claude Docs, hence the Markdown exports).
2. Connect GitHub to Claude Code on the web.
3. Create a routine at claude.ai/code/routines: this repo, Default environment (npm and
   common dev domains only — no Supabase access, which is good), **remove all connectors**.
4. Trigger: custom cron `CRON_TZ=Asia/Bangkok 7 10 * * 1-5` (weekdays 10:07 Bangkok); if
   the prefix isn't accepted, `7 3 * * 1-5` (same time in UTC).
5. After 2–3 runs, check usage before deciding on 2 runs a day.

Routine prompt:

```
You are building Growing With Vyvian. Read CLAUDE.md, docs/spec.md,
docs/build-plan.md and PROGRESS.md before doing anything.

1. Pick the FIRST unchecked item in PROGRESS.md tagged [AI].
   If the next unchecked item is tagged [HUMAN], do not work on it:
   append a short checklist of what the human must do under "Blocked"
   in PROGRESS.md, open a PR with only that change, and stop.
2. Do only that one item. Do not start the next one.
3. Never edit src/domain/rules.ts after it exists. Never add features
   outside docs/spec.md. Never push to main.
4. Run npm test (and npm run build once it exists).
   If anything fails and you cannot fix it within this item,
   write the cause under "Blocked" in PROGRESS.md and stop.
5. Tick the item in PROGRESS.md, add one line to "Log"
   (date, item, what changed, anything the human must check),
   open a pull request, and stop.
```

Cautions:
- Cloud runs start in auto mode with nobody approving steps; the prompt and PR review are
  the guard. Branch protection on `main` may not stop an admin-linked account.
- Never put the Supabase secret key or DB password in the task's environment.
- "Succeeded" only means the session ended without error — read the PR.
- An unmerged PR means the next run starts from `main` and may redo the item: merge/close
  it first, or pause the task.

Do a 2–3 day dry run before day 1, delete the rehearsal rows by SQL, then set `start_date`
and start the change freeze.

## Mobile checklist (before day 1)

- [ ] Installs to the home screen and opens without browser chrome (Android and iPad)
- [ ] Log in inside the installed app; close and reopen without logging in again (both devices; check in on Android, see it on iPad)
- [ ] Check-in of all 3 fields within 10 s (check `duration_ms` in the DB)
- [ ] Network off → Save shows the right message and the form keeps its data
- [ ] 23:59, 00:00, 00:01 show pass / pass / fail
- [ ] Opening after midnight moves "yesterday" correctly
- [ ] Dark mode readable on every screen
- [ ] Keep-alive GitHub Action ran once and the backup produced a file with data

## Sources (read 2026-10-28)

- Supabase: Migrating to publishable and secret API keys
- Supabase changelog: API key changes timeline
- Supabase free tier limits 2026 (third-party article)
- iOS home-screen apps keep cookies separate from Safari (third-party reports)
- Magic links open in Safari, not the home-screen app (third-party reports)
