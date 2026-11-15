-- Behaviour tests for 0001_init.sql. Run with supabase/tests/run-local.sh
\set ON_ERROR_STOP on
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'

create function pg_temp.expect_error(sql text, pattern text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm not like pattern then
      raise exception 'TEST FAILED: wrong error for [%]: %', sql, sqlerrm;
    end if;
    return;
  end;
  raise exception 'TEST FAILED: expected an error for [%]', sql;
end $$;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'TEST FAILED: %', label; end if;
  raise notice 'ok - %', label;
end $$;
create function pg_temp.bkk(n int) returns date language sql as $$
  select (now() at time zone 'Asia/Bangkok')::date + n
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- Seed, as the DB owner with the trigger off, rows that "were written on earlier days":
alter table public.checkins disable trigger checkins_window;
insert into public.checkins (user_id, date, water_ml, rules_version)          -- water-only, yesterday
  values (:'A', pg_temp.bkk(-1), 600, 'mvp-1');
insert into public.checkins (user_id, date, water_ml, rules_version)          -- water-only, 5 days ago
  values (:'A', pg_temp.bkk(-5), 900, 'mvp-1');
insert into public.checkins (user_id, date, steps, water_ml, lights_off, rules_version, completed_at, duration_ms)
  values (:'A', pg_temp.bkk(-4), 6000, 1500, '23:30', 'mvp-1', now() - interval '3 days', 9000); -- closed on time, window now shut
insert into public.checkins (user_id, date, steps, water_ml, lights_off, rules_version, completed_at)
  values (:'B', pg_temp.bkk(-1), 1, 1, '23:00', 'mvp-1', now());             -- another user's row
alter table public.checkins enable trigger checkins_window;

-- ---------- anon: nothing ----------
set role anon;
select pg_temp.expect_error('select * from public.checkins', 'permission denied%');
reset role;

-- ---------- user A ----------
set role authenticated;
set request.jwt.claim.sub = :'A';

select pg_temp.check_true((select count(*) = 3 from public.checkins), 'RLS: A sees only own 3 rows');
select pg_temp.check_true((select count(*) = 0 from public.checkins where user_id = :'B'), 'RLS: A cannot see B');

-- future date rejected
select pg_temp.expect_error(format(
  'insert into public.checkins (date, water_ml, rules_version) values (%L, 100, ''mvp-1'')', pg_temp.bkk(1)),
  'cannot log a future date%');

-- today: water-only row accepted, stays open; client-sent verdict fields are ignored
insert into public.checkins (date, water_ml, rules_version, late, completed_at, edit_count, duration_ms)
  values (pg_temp.bkk(0), 250, 'mvp-1', true, now(), 99, 1234);
select pg_temp.check_true((select completed_at is null and not late and edit_count = 0 and duration_ms is null
  from public.checkins where date = pg_temp.bkk(0)), 'today: water-only row stays open, client verdict fields ignored');

-- today: even with all 3 values the day is not closed
update public.checkins set water_ml = 800, steps = 3000, lights_off = '23:00' where date = pg_temp.bkk(0);
select pg_temp.check_true((select completed_at is null and edit_count = 0 from public.checkins where date = pg_temp.bkk(0)),
  'today: never closed, water top-ups do not bump edit_count');

-- yesterday: morning check-in closes the water-only row on time
update public.checkins set steps = 5200, lights_off = '23:40', water_ml = 1500, duration_ms = 8200
  where date = pg_temp.bkk(-1);
select pg_temp.check_true((select completed_at is not null and not late and duration_ms = 8200 and edit_count = 0
  from public.checkins where date = pg_temp.bkk(-1)), 'yesterday: closed on time, duration kept, edit_count 0');

-- edit inside the window: allowed, duration frozen, edit_count + 1, completed_at unchanged
create temp table t as select completed_at from public.checkins where date = pg_temp.bkk(-1);
update public.checkins set steps = 5300, duration_ms = 1, late = true where date = pg_temp.bkk(-1);
select pg_temp.check_true((select c.steps = 5300 and c.duration_ms = 8200 and c.edit_count = 1 and not c.late
  and c.completed_at = t.completed_at from public.checkins c, t where c.date = pg_temp.bkk(-1)),
  'edit in window: duration/late/completed_at frozen, edit_count = 1');

-- a closed day cannot be re-opened by nulling values
select pg_temp.expect_error(format('update public.checkins set steps = null where date = %L', pg_temp.bkk(-1)),
  '%checkins_closed_has_values%');

-- today-2: fresh insert closes on time
insert into public.checkins (date, steps, water_ml, lights_off, rules_version)
  values (pg_temp.bkk(-2), 4000, 1400, '00:00', 'mvp-1');
select pg_temp.check_true((select completed_at is not null and not late from public.checkins where date = pg_temp.bkk(-2)),
  'today-2: on time');

-- today-3: fresh insert is accepted but late
insert into public.checkins (date, steps, water_ml, lights_off, rules_version)
  values (pg_temp.bkk(-3), 9000, 2000, '22:00', 'mvp-1');
select pg_temp.check_true((select completed_at is not null and late from public.checkins where date = pg_temp.bkk(-3)),
  'today-3: accepted, late = true');

-- today-5 water-only row closed now: late (decided at close time, not insert time)
update public.checkins set steps = 7000, lights_off = '23:00' where date = pg_temp.bkk(-5);
select pg_temp.check_true((select completed_at is not null and late from public.checkins where date = pg_temp.bkk(-5)),
  'old water-only row closed late');

-- late rows stay editable
update public.checkins set steps = 7100 where date = pg_temp.bkk(-5);
select pg_temp.check_true((select steps = 7100 and late and edit_count = 1 from public.checkins where date = pg_temp.bkk(-5)),
  'late row editable');

-- on-time row whose window has shut is locked
select pg_temp.expect_error(format('update public.checkins set steps = 99999 where date = %L', pg_temp.bkk(-4)),
  'on-time entry for % is closed');

-- immutable keys, no delete, cannot write as another user, cannot touch B's row
select pg_temp.expect_error(format('update public.checkins set date = %L where date = %L', pg_temp.bkk(-6), pg_temp.bkk(-5)),
  'date and user_id are immutable');
select pg_temp.expect_error('delete from public.checkins', 'permission denied%');
select pg_temp.expect_error(format(
  'insert into public.checkins (user_id, date, water_ml, rules_version) values (%L, %L, 1, ''mvp-1'')', :'B', pg_temp.bkk(-6)),
  '%row-level security%');
update public.checkins set steps = 2 where user_id = :'B';
reset role;
select pg_temp.check_true((select steps = 1 from public.checkins where user_id = :'B'), 'RLS: A cannot update B');

-- value checks
set role authenticated;
select pg_temp.expect_error(format(
  'insert into public.checkins (date, water_ml, rules_version) values (%L, 10001, ''mvp-1'')', pg_temp.bkk(-7)), '%check%');
select pg_temp.expect_error(format(
  'insert into public.checkins (date, water_ml, steps, lights_off, rules_version) values (%L, 1, 1, ''24:00'', ''mvp-1'')', pg_temp.bkk(-7)), '%check%');

-- settings: own row only
insert into public.settings (start_date) values (pg_temp.bkk(0));
select pg_temp.check_true((select count(*) = 1 and bool_and(water_buttons = '{780,600,550,250}') from public.settings),
  'settings: default buttons, own row');
select pg_temp.expect_error('delete from public.settings', 'permission denied%');
reset role;

select 'ALL DATABASE TESTS PASSED' as result;
