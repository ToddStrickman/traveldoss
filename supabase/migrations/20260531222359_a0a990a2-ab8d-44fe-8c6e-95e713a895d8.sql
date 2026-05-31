-- 1. Loosen date requirements
ALTER TABLE public.trips ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE public.trips ALTER COLUMN end_date DROP NOT NULL;

-- 2. New columns
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'unlisted',
  ADD COLUMN IF NOT EXISTS template_id TEXT,
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS tone TEXT,
  ADD COLUMN IF NOT EXISTS content JSONB;

-- 3. Visibility check
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_visibility_check;
ALTER TABLE public.trips
  ADD CONSTRAINT trips_visibility_check
  CHECK (visibility IN ('unlisted', 'public', 'private'));

-- 4. Backfill slug for any existing rows
UPDATE public.trips
SET slug = 'trip-' || substr(id::text, 1, 8)
WHERE slug IS NULL;

ALTER TABLE public.trips ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trips_slug_unique ON public.trips (slug);

-- 5. Grants — allow anon to read trips (RLS will filter to non-private)
GRANT SELECT ON public.trips TO anon;

-- 6. Public-read policy by visibility (additive to existing owner policies)
DROP POLICY IF EXISTS "Public can view shared trips" ON public.trips;
CREATE POLICY "Public can view shared trips"
ON public.trips
FOR SELECT
TO anon, authenticated
USING (visibility IN ('unlisted', 'public'));