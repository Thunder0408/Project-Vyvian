---
name: vyvian-domain-change
description: Use before changing anything in vyvian/src/domain/ (evaluate.ts, timeline.ts, time.ts, types.ts, rules.ts) or when a question is about how days are judged — status, streak, grace pass, stage, mood, decor, check-in window. Enforces the frozen-rules and purity rules and the test-first workflow.
---

# Changing the Vyvian domain layer

## 1. Classify the change first

Say which kind it is before touching code:

| Kind | Allowed? | Where |
|---|---|---|
| Bug: code disagrees with `docs/spec.md` / `docs/build-plan.md` | Yes | `evaluate.ts` / `timeline.ts` / `time.ts` |
| New derived value for the UI (e.g. "days left in trial") | Yes | new pure function, or a field on `Timeline` |
| Change a number in `RULES_MVP1` | **No, until day 30** | — stop and tell the owner |
| New rule set after the trial | Yes, with the owner's go-ahead | new `RULES_MVP2` with a new `version`; keep `RULES_MVP1` |

If it changes a rule's *meaning*, give the owner 2–3 options with trade-offs and wait for a decision.

## 2. Hard constraints

- Domain files import only from `./…` — no React, Supabase, Node, `fetch`, `Date.now()`
  inside logic (only `bangkokToday()` touches the clock, and callers pass `today` in).
- Dates are `'YYYY-MM-DD'` strings; use `addDays`/`diffDays`, never `new Date(str)` math.
- Nothing derived goes to the DB.
- `strict` + `noUncheckedIndexedAccess`: array access returns `T | undefined` — handle it.

## 3. Test first

1. Write the failing test in `src/domain/__tests__/` in the existing plain-sentence style.
   For timeline cases use the day-code DSL from `helpers.ts`:
   `'C3'` on time 3/3, `'C2'` 2/3, `'L1'` 1/3, `'L0'` 0/3, `'T3'` late 3/3,
   `'W'` water-only (never closed), `'-'` no row. Use `fromCodes([...])` and `repeat(code, n)`.
2. Run `npm test` → see it fail for the right reason.
3. Change the code.
4. `npm test` and `npm run typecheck` both green.

## 4. Done when

- [ ] Tests + typecheck green (paste the summary line)
- [ ] `docs/spec.md` / `docs/build-plan.md` still matches the code (update it if behaviour was clarified)
- [ ] Non-obvious decision recorded in `docs/decisions.md`
