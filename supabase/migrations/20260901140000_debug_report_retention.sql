-- Phase 2 retention (backend audit, 2026-08-31).
--
-- `parse_debug_reports` stores the AI parser's diagnostic output (raw model
-- responses, retry attempts) whenever a parse needs a retry or falls back.
-- Nothing reads it except a developer panel that is currently unmounted, and
-- nothing ever deleted from it, so it grew without bound at ~50-150 KB per
-- report. The itinerary itself lives in `trips.content`; these rows are
-- error diagnostics, not user data.
--
-- Retention: 90 days, swept nightly. The write path now also caps each
-- report's size (see capDebugReport in src/lib/itinerary/debug-report.ts).

-- The sweep filters on created_at; the existing (user_id, created_at DESC)
-- index cannot serve a range scan on created_at alone.
create index if not exists parse_debug_reports_created_at_idx
  on public.parse_debug_reports (created_at);

-- `trip_access_events` (one row per public dossier view) has the same shape
-- of problem and only a (trip_id, occurred_at DESC) index. No retention job
-- is scheduled for it yet -- that is an owner-facing history and the window
-- is a product decision -- but the index it will need costs nothing now.
create index if not exists trip_access_events_occurred_at_idx
  on public.trip_access_events (occurred_at);

-- Same fault-tolerant shape as 20260901120100: never let a missing pg_cron
-- block later migrations.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise warning 'pg_cron not available (%): retention-parse-debug-reports NOT scheduled', sqlerrm;
    return;
  end;

  if exists (select 1 from cron.job where jobname = 'retention-parse-debug-reports') then
    perform cron.unschedule('retention-parse-debug-reports');
  end if;

  perform cron.schedule(
    'retention-parse-debug-reports',
    '15 3 * * *',
    $job$
      delete from public.parse_debug_reports
       where created_at < now() - interval '90 days'
    $job$
  );
end
$$;
