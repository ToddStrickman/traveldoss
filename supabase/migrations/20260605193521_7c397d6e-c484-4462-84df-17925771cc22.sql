ALTER TABLE public.trip_doc_previews
  DROP CONSTRAINT IF EXISTS trip_doc_previews_source_check;

ALTER TABLE public.trip_doc_previews
  ADD CONSTRAINT trip_doc_previews_source_check
  CHECK (source = ANY (ARRAY['gmail'::text, 'manual'::text, 'export'::text]));