CREATE TABLE public.parse_debug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trip_id uuid,
  source text NOT NULL,
  outcome text NOT NULL,
  attempts_count integer NOT NULL DEFAULT 0,
  report jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.parse_debug_reports TO authenticated;
GRANT ALL ON public.parse_debug_reports TO service_role;
ALTER TABLE public.parse_debug_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own debug reports read" ON public.parse_debug_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own debug reports insert" ON public.parse_debug_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own debug reports delete" ON public.parse_debug_reports FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX parse_debug_reports_user_created_idx ON public.parse_debug_reports (user_id, created_at DESC);
CREATE INDEX parse_debug_reports_trip_idx ON public.parse_debug_reports (trip_id);