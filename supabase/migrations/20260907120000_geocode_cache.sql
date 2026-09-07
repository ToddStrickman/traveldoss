-- Live Map v2, Phase 1: shared geocode cache.
--
-- Replaces the per-isolate in-memory cache in src/lib/itinerary/geo.server.ts.
-- One row per distinct normalised query (hashed). Hits store coordinates and
-- the Google Places id; misses store nulls and are honoured for seven days by
-- the reader. Server-only: the service role reads and writes through
-- supabaseAdmin and no client policy exists on purpose.

create table if not exists public.geocode_cache (
  query_hash  text primary key,
  query       text not null,
  lat         double precision,
  lng         double precision,
  place_id    text,
  provider    text not null,
  resolved_at timestamptz not null default now(),
  miss_count  int not null default 0
);

comment on table public.geocode_cache is
  'Live Map geocode cache. Server-only; keyed by sha256 of the normalised query.';

grant all on public.geocode_cache to service_role;

alter table public.geocode_cache enable row level security;
-- No policies for anon or authenticated: the table is unreachable from the browser.

create index if not exists idx_geocode_cache_resolved_at on public.geocode_cache (resolved_at);
