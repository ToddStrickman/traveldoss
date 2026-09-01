-- Phase 2 cleanup, step 2 of 2 (backend audit, 2026-08-31).
--
-- Step 1 (PR #47) removed every read and write of these from application
-- code, so by the time this runs no deployed code touches them. Do not
-- reorder: dropping a column that a still-serving Worker writes would fail
-- trip creation until the redeploy lands.
--
-- `places`: the abandoned pre-Block schema (one row per stop). The live
-- content model is a flat Block[] in `trips.content`; its category
-- vocabulary is different, and nothing has referenced this table since.
-- The five `trips` columns were write-only or never touched.
--
-- Kept on purpose (Todd, 2026-09-01): `app_config`, `drive_watch_channels`
-- and `trips.doc_id` / `doc_url` (Google Doc infrastructure), and
-- `trip_entitlements` (pending the payment-processor decision).

drop table if exists public.places;
drop type if exists public.place_category;

alter table public.trips
  drop column if exists keywords,
  drop column if exists locked_at,
  drop column if exists locked_snapshot,
  drop column if exists original_template_id,
  drop column if exists tone;
