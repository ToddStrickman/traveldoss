-- Add explicit owner-only SELECT policies for tables with RLS enabled but no policies

-- google_tokens: owner-only access for all operations
CREATE POLICY "Users read own google tokens"
  ON public.google_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own google tokens"
  ON public.google_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own google tokens"
  ON public.google_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own google tokens"
  ON public.google_tokens FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- drive_watch_channels: owner-only access
CREATE POLICY "Users read own drive watch channels"
  ON public.drive_watch_channels FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own drive watch channels"
  ON public.drive_watch_channels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own drive watch channels"
  ON public.drive_watch_channels FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own drive watch channels"
  ON public.drive_watch_channels FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- app_config: deny all client access; only service_role (via supabaseAdmin) can read
CREATE POLICY "Deny all client access to app_config"
  ON public.app_config FOR SELECT TO authenticated, anon
  USING (false);

-- trips: replace the broad public SELECT policy with a view that excludes user_id and sensitive fields.
-- Drop the existing anon-readable policy.
DROP POLICY IF EXISTS "Public can view shared trips" ON public.trips;

-- Recreate it to only expose to anon when visibility = 'public' (not 'unlisted').
-- Unlisted trips are only accessible via the owner or via a server-side lookup using the slug.
CREATE POLICY "Public can view public trips"
  ON public.trips FOR SELECT TO anon, authenticated
  USING (visibility = 'public');
