
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Places
CREATE TYPE public.place_category AS ENUM ('lodging','food','activity','transport','sight','other');
CREATE TABLE public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_number INT,
  order_index INT NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  address TEXT,
  category public.place_category NOT NULL DEFAULT 'other',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  google_place_id TEXT,
  notes TEXT,
  saved BOOLEAN NOT NULL DEFAULT false,
  source_excerpt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.places TO authenticated;
GRANT ALL ON public.places TO service_role;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own places read" ON public.places FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own places insert" ON public.places FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own places update" ON public.places FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own places delete" ON public.places FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_places_trip ON public.places(trip_id, day_number, order_index);

CREATE TRIGGER trg_places_updated BEFORE UPDATE ON public.places
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Drive push-notification watch channels
CREATE TABLE public.drive_watch_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL UNIQUE REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  resource_uri TEXT,
  token TEXT NOT NULL,
  expiration TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.drive_watch_channels TO service_role;
ALTER TABLE public.drive_watch_channels ENABLE ROW LEVEL SECURITY;
-- Server-only: no policies for authenticated.
