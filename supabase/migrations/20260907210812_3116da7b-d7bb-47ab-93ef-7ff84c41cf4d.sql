CREATE TABLE public.geocode_cache (
  query_hash text PRIMARY KEY,
  query text NOT NULL,
  lat double precision,
  lng double precision,
  place_id text,
  provider text NOT NULL,
  resolved_at timestamp with time zone NOT NULL DEFAULT now(),
  miss_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.geocode_cache TO service_role;

ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER geocode_cache_set_updated_at
BEFORE UPDATE ON public.geocode_cache
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();