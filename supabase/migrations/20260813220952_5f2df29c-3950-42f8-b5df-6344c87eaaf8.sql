CREATE TABLE public.trip_access_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  trip_slug text NOT NULL,
  actor_user_id uuid,
  is_owner boolean NOT NULL DEFAULT false,
  event_type text NOT NULL,
  visitor_hash text,
  user_agent text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trip_access_events_event_type_check
    CHECK (event_type IN ('view', 'export_pdf', 'export_ics', 'export_gdoc'))
);

CREATE INDEX trip_access_events_trip_id_occurred_at_idx
  ON public.trip_access_events (trip_id, occurred_at DESC);

GRANT SELECT ON public.trip_access_events TO authenticated;
GRANT ALL ON public.trip_access_events TO service_role;

ALTER TABLE public.trip_access_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip owners read their access events"
  ON public.trip_access_events
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_access_events.trip_id
      AND t.user_id = auth.uid()
  ));

CREATE POLICY "Deny client inserts on trip_access_events"
  ON public.trip_access_events
  AS RESTRICTIVE FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Deny client updates on trip_access_events"
  ON public.trip_access_events
  AS RESTRICTIVE FOR UPDATE
  TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny client deletes on trip_access_events"
  ON public.trip_access_events
  AS RESTRICTIVE FOR DELETE
  TO anon, authenticated
  USING (false);