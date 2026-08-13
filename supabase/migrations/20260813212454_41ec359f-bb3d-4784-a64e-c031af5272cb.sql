-- Public dossiers are served exclusively by the server function
-- getDossierBySlug, which selects an explicit safe column whitelist through
-- the service-role client. The broad anon/authenticated SELECT policy exposed
-- every column (doc ids/urls, locked snapshots, user_id, visibility) of any
-- trip with visibility='public'. Remove it; owner reads keep their own policy.
DROP POLICY IF EXISTS "Public can view public trips" ON public.trips;

REVOKE SELECT ON public.trips FROM anon;