
CREATE TABLE public.trip_doc_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  user_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('gmail','manual')),
  source_message_id text,
  google_doc_id text NOT NULL,
  google_doc_url text NOT NULL,
  preview_html text,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_message_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_doc_previews TO authenticated;
GRANT ALL ON public.trip_doc_previews TO service_role;

ALTER TABLE public.trip_doc_previews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own trip_doc_previews read"
  ON public.trip_doc_previews FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own trip_doc_previews insert"
  ON public.trip_doc_previews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own trip_doc_previews update"
  ON public.trip_doc_previews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own trip_doc_previews delete"
  ON public.trip_doc_previews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX trip_doc_previews_trip_idx ON public.trip_doc_previews (trip_id);

CREATE TRIGGER trip_doc_previews_set_updated_at
  BEFORE UPDATE ON public.trip_doc_previews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
