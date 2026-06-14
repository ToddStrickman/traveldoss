-- 1. app_config: convert permissive deny to RESTRICTIVE deny
DROP POLICY IF EXISTS "Deny all client access to app_config" ON public.app_config;

CREATE POLICY "Deny all client access to app_config"
ON public.app_config
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- 2. trip_entitlements: revoke client writes and add explicit restrictive denies
REVOKE INSERT, UPDATE, DELETE ON public.trip_entitlements FROM anon, authenticated;

DROP POLICY IF EXISTS "Deny client inserts on trip_entitlements" ON public.trip_entitlements;
CREATE POLICY "Deny client inserts on trip_entitlements"
ON public.trip_entitlements
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny client updates on trip_entitlements" ON public.trip_entitlements;
CREATE POLICY "Deny client updates on trip_entitlements"
ON public.trip_entitlements
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny client deletes on trip_entitlements" ON public.trip_entitlements;
CREATE POLICY "Deny client deletes on trip_entitlements"
ON public.trip_entitlements
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);
