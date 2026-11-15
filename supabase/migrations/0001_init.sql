-- Growing With Vyvian — initial schema (rules version: mvp-1)
-- Source: docs/build-plan.md, "Migration 0001_init.sql" merged with
-- "บันทึกระหว่างวัน" (decided 2026-11-10). Run once in the Supabase SQL editor.
--
-- All dates are Asia/Bangkok calendar days. "today" below = the Bangkok date now.
--   date = today            -> water can be logged during the day; the row stays open
--   date = today-1, today-2 -> the morning check-in closes the day on time (counts)
--   date < today-2          -> the day can still be closed, but late = true (never counts)
--   date > today            -> rejected

-- 1) Raw daily values: one row per reported day D
create table public.checkins (
  user_id       uuid not null default auth.uid()
                references auth.users(id) on delete cascade,
  date          date not null,                              -- reported day D
  steps         int  check (steps between 0 and 100000),    -- null until the day is closed
  home_day      boolean not null default false,
  water_ml      int  not null default 0 check (water_ml between 0 and 10000),
  lights_off    time check (lights_off < time '24:00'),     -- null until closed; 00:00 = midnight
  rules_version text not null,                              -- 'mvp-1'
  duration_ms   int  check (duration_ms >= 0),              -- first close only (set by trigger rules)
  edit_count    int  not null default 0,                    -- edits made after the day was closed
  late          boolean not null default false,             -- closed after the window: kept, never counted
  completed_at  timestamptz,                                -- set by the trigger when the day is closed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, date),
  constraint checkins_closed_has_values
    check (completed_at is null or (steps is not null and lights_off is not null))
);

-- 2) Per-user settings (not rules; rules live in src/domain/rules.ts)
create table public.settings (
  user_id       uuid primary key default auth.uid()
                references auth.users(id) on delete cascade,
  start_date    date not null,                              -- first day D of the 30-day trial
  water_buttons int[] not null default '{780,600,550,250}'
);

-- 3) Server-side guard. The client can never set completed_at, late, created_at,
--    updated_at or edit_count; the trigger decides all of them.
create function public.enforce_checkin_window()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Bangkok')::date;
  was_closed boolean := false;
begin
  if new.date > today then
    raise exception 'cannot log a future date (%)', new.date;
  end if;

  if tg_op = 'UPDATE' then
    if new.date <> old.date or new.user_id <> old.user_id then
      raise exception 'date and user_id are immutable';
    end if;
    was_closed := old.completed_at is not null;
    if was_closed and not old.late and new.date < today - 2 then
      raise exception 'on-time entry for % is closed', new.date;
    end if;
    new.created_at := old.created_at;
    new.edit_count := old.edit_count;
  else
    new.created_at := now();
    new.edit_count := 0;
  end if;

  if was_closed then
    -- Editing a day that is already closed: its verdict inputs stay frozen.
    new.completed_at := old.completed_at;
    new.late         := old.late;
    new.duration_ms  := old.duration_ms;
    new.edit_count   := old.edit_count + 1;
  elsif new.steps is not null and new.lights_off is not null and new.date < today then
    -- First time the row holds all three values for a past day: close it now.
    new.completed_at := now();
    new.late         := new.date < today - 2;
  else
    -- Still open (water logged during the day, or values missing).
    new.completed_at := null;
    new.late         := false;
    new.duration_ms  := null;
  end if;

  new.updated_at := now();
  return new;
end
$$;

create trigger checkins_window
  before insert or update on public.checkins
  for each row execute function public.enforce_checkin_window();

-- 4) RLS: a user sees and edits only their own rows. No delete policy.
alter table public.checkins enable row level security;
alter table public.settings enable row level security;

create policy checkins_select on public.checkins for select to authenticated
  using ((select auth.uid()) = user_id);
create policy checkins_insert on public.checkins for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy checkins_update on public.checkins for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy settings_select on public.settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy settings_insert on public.settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy settings_update on public.settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 5) Data API grants. Supabase projects created after 2026-05-30 (and all projects
--    from 2026-10-30) no longer expose new public tables automatically; without
--    these grants supabase-js fails with "permission denied for table" (42501).
--    Signed-in users only; no delete; nothing for anon.
revoke all on table public.checkins, public.settings from anon, authenticated;
grant select, insert, update on table public.checkins to authenticated;
grant select, insert, update on table public.settings to authenticated;
revoke execute on function public.enforce_checkin_window() from public, anon, authenticated;
