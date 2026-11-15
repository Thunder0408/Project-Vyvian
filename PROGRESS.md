# Progress

One `[AI]` item per run, in order. `[HUMAN]` items need the owner (accounts, devices,
approvals). See `docs/build-plan.md` → Milestones for what "done" means.

## Items
- [x] [AI] TypeScript + Vitest scaffold; `npm test` and `npm run typecheck` pass
- [ ] [AI] Add Vite + React + ESLint to the scaffold; `npm run build` passes (keep `src/domain/` untouched)
- [x] [AI] `supabase/migrations/0001_init.sql` from docs/build-plan.md (with intraday logging) + local DB tests
- [ ] [HUMAN] Create Supabase project, run migration, add user, disable sign-up, insert settings row
- [x] [AI] domain/time.ts + tests (Bangkok dates, sleep minutes)
- [x] [AI] domain/rules.ts + evaluate.ts + boundary tests
- [x] [AI] domain/timeline.ts + replay tests (grace, streak, stage, mood, decor)
- [ ] [AI] data/ layer + AppProvider (no real network calls in tests)
- [ ] [HUMAN] Verify login and trigger window against real Supabase
- [ ] [HUMAN] Approve hi-fi designs (Home, Check-in, History) and export them to docs/design/
- [ ] [AI] Draft Vyvian SVGs: 4 stages with #body #gills #eyes-open #eyes-closed groups
- [ ] [AI] UI foundation: tokens.css, fonts, layout shell, bottom nav (match docs/design/)
- [ ] [AI] Check-in screen with draft and duration_ms
- [ ] [HUMAN] Time 3 check-ins on Android (target ≤ 10 s each)
- [ ] [AI] Home + Vyvian (4 stages × 3 moods), streak, pass, CTA, today's water bar
- [ ] [AI] History: 5-week grid + day detail sheet + late logging
- [ ] [AI] Game layer: feeding animation, tap to play, tank decor, stage-up scene
- [ ] [AI] PWA: manifest, icons, service worker, vercel.json rewrite
- [ ] [AI] GitHub Actions: keep-alive (every 3 days) + weekly data backup
- [ ] [HUMAN] Deploy to Vercel, add env vars and Actions secrets, run both Actions once
- [ ] [HUMAN] Mobile checklist + 2–3 day dry run, delete rehearsal rows, set start_date

## Blocked
_(nothing)_

## Log
- 2026-11-15 — repo set up: CLAUDE.md, docs (spec, build-plan, decisions), PROGRESS.md, project skills. Domain layer + 0001_init.sql were already written and tested.
