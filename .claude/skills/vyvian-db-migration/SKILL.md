---
name: vyvian-db-migration
description: Use when adding or changing anything in the Vyvian Supabase database — tables, columns, the enforce_checkin_window trigger, RLS policies, grants — or when writing supabase-js queries that write to checkins/settings. Covers append-only migrations, trigger-owned columns, and the local psql test harness.
---

# Vyvian database changes

## Rules

1. **Append-only.** Never edit `supabase/migrations/0001_init.sql` once it has run on the
   real project. Create `supabase/migrations/000N_<short_name>.sql`.
2. **Every migration gets a test file** `supabase/tests/000N_<short_name>.test.sql` using
   `pg_temp.expect_error` / `pg_temp.check_true` like `0001_init.test.sql`, and
   `run-local.sh` must load it after the migration.
3. **Raw values only.** No derived columns (streak, stage, status…) — the domain computes them.
4. **Trigger-owned columns** (`completed_at`, `late`, `edit_count`, `created_at`,
   `updated_at`, `duration_ms` after close) are never written by the client. Client code
   sends only `date`, `steps`, `home_day`, `water_ml`, `lights_off`, `rules_version`,
   and `duration_ms` on the first close.
5. **Every new table:** `enable row level security`, select/insert/update policies on
   `(select auth.uid()) = user_id`, explicit `grant … to authenticated`, nothing for `anon`,
   no delete unless the owner decides otherwise. Functions: `set search_path = ''` and
   revoke execute from `public, anon, authenticated` unless they are meant to be called.
6. Time logic uses `(now() at time zone 'Asia/Bangkok')::date`, matching `bangkokToday()`.

## Workflow

1. Explain the change and options to the owner; agree on it.
2. Write the test file first (expected behaviour + expected errors).
3. Write the migration.
4. Run locally (needs PostgreSQL; never against Supabase):
   ```bash
   PGUSER=postgres ./supabase/tests/run-local.sh
   ```
   Done = last line `ALL DATABASE TESTS PASSED`.
5. The owner runs the migration in the Supabase SQL editor — Claude never runs SQL
   on the real project without an explicit go-ahead.
6. Update `docs/build-plan.md` (Backend section) and `docs/decisions.md`.

## Never

- Run `supabase/tests/local_stub.sql` on a real Supabase project (it creates fake `auth`).
- Add a delete policy or grant to "make something work".
- Disable the trigger outside the test seed block.
