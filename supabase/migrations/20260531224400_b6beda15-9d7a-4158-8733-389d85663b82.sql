
-- 1. Extend trips with expiry + audit field
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_template_id TEXT;

CREATE INDEX IF NOT EXISTS trips_expires_at_idx ON public.trips (expires_at);

-- 2. Entitlements table — one row per (trip, template) purchase
CREATE TABLE public.trip_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  template_id TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL DEFAULT 100,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'active',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX trip_entitlements_trip_idx ON public.trip_entitlements (trip_id);
CREATE INDEX trip_entitlements_user_idx ON public.trip_entitlements (user_id);
CREATE INDEX trip_entitlements_trip_template_idx
  ON public.trip_entitlements (trip_id, template_id)
  WHERE status = 'active';

GRANT SELECT ON public.trip_entitlements TO authenticated;
GRANT ALL ON public.trip_entitlements TO service_role;

ALTER TABLE public.trip_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their entitlements"
  ON public.trip_entitlements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
