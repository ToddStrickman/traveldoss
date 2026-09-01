-- Phase 1 hardening (backend audit, 2026-08-31).
--
-- A `trip_doc_previews` row is inserted as status = 'pending' right after the
-- Google Doc is created and before batchUpdate writes its contents. If the
-- writer dies (crash, network loss, worker timeout) the row stays 'pending'
-- forever, and every retry of the same export takes the slow reuse-and-rewrite
-- path. A sweep for this existed as the HTTP route
-- /api/public/hooks/cleanup-pending-doc-exports, documented as "triggered by
-- pg_cron every 5 minutes" -- but no schedule was ever created, so it never
-- ran, and the route was an unauthenticated public POST. The sweep now runs
-- inside Postgres on a real schedule; the HTTP route is removed.

create extension if not exists pg_cron;
grant usage on schema cron to postgres;

-- The sweep only ever touches in-flight rows. A partial index keeps it
-- O(pending) instead of a full-table scan that grows with every export.
create index if not exists trip_doc_previews_pending_sweep_idx
  on public.trip_doc_previews (updated_at)
  where status = 'pending';

-- Idempotent re-runs: newer pg_cron upserts by job name, older versions error
-- on a duplicate, so unschedule first if the job already exists.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sweep-pending-doc-exports') then
    perform cron.unschedule('sweep-pending-doc-exports');
  end if;
end
$$;

select cron.schedule(
  'sweep-pending-doc-exports',
  '*/5 * * * *',
  $job$
    update public.trip_doc_previews
       set status = 'failed'
     where status = 'pending'
       and updated_at < now() - interval '10 minutes'
  $job$
);
