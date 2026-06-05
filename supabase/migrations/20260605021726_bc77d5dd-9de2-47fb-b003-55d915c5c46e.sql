CREATE TABLE public.saved_trip_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_trip_requests TO authenticated;
GRANT ALL ON public.saved_trip_requests TO service_role;

ALTER TABLE public.saved_trip_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own saved trip requests read"
  ON public.saved_trip_requests FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own saved trip requests insert"
  ON public.saved_trip_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own saved trip requests update"
  ON public.saved_trip_requests FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own saved trip requests delete"
  ON public.saved_trip_requests FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX saved_trip_requests_user_idx ON public.saved_trip_requests(user_id, updated_at DESC);

CREATE TRIGGER set_saved_trip_requests_updated_at
  BEFORE UPDATE ON public.saved_trip_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();