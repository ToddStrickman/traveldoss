-- Shared trip planning: members, invites, and an attributed change history.
CREATE TABLE public.trip_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','editor')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','pending_approval','active','removed','declined')),
  source text NOT NULL DEFAULT 'creator_invite' CHECK (source IN ('owner','creator_invite','member_invite','named_in_trip')),
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trip_members_trip_email_key ON public.trip_members (trip_id, lower(email));
CREATE INDEX trip_members_user_idx ON public.trip_members (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE public.trip_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trip_invites_trip_idx ON public.trip_invites (trip_id);

CREATE TABLE public.trip_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_kind text NOT NULL DEFAULT 'user' CHECK (actor_kind IN ('user','system')),
  action text NOT NULL DEFAULT 'edit' CHECK (action IN ('add','edit','delete','restore','rollback')),
  before jsonb,
  after jsonb,
  added_count integer NOT NULL DEFAULT 0,
  removed_count integer NOT NULL DEFAULT 0,
  restores_change_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trip_changes_trip_created_idx ON public.trip_changes (trip_id, created_at DESC);

GRANT SELECT ON public.trip_members TO authenticated;
GRANT ALL ON public.trip_members TO service_role;
GRANT ALL ON public.trip_invites TO service_role;
GRANT SELECT ON public.trip_changes TO authenticated;
GRANT ALL ON public.trip_changes TO service_role;

ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_changes ENABLE ROW LEVEL SECURITY;

-- Membership test used by policies. SECURITY DEFINER so policies on trips can
-- consult trip_members without recursing through trip_members' own policies.
CREATE OR REPLACE FUNCTION public.is_trip_member(_trip_id uuid, _roles text[] DEFAULT ARRAY['owner','editor'])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = _trip_id AND t.user_id = auth.uid() AND 'owner' = ANY(_roles)
  ) OR EXISTS (
    SELECT 1 FROM public.trip_members m
    WHERE m.trip_id = _trip_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trip_owner(_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.trips t WHERE t.id = _trip_id AND t.user_id = auth.uid());
$$;

-- Members see the active roster; the owner sees every row, pending included.
CREATE POLICY "Members read the active roster"
ON public.trip_members FOR SELECT TO authenticated
USING (
  (status = 'active' AND public.is_trip_member(trip_id))
  OR public.is_trip_owner(trip_id)
  OR user_id = auth.uid()
);

-- History is owner-only (HISTORY_VISIBILITY = owner_only).
CREATE POLICY "Owners read trip history"
ON public.trip_changes FOR SELECT TO authenticated
USING (public.is_trip_owner(trip_id));

-- Active co-planners can read and edit the trip's contents.
CREATE POLICY "Members read their trips"
ON public.trips FOR SELECT TO authenticated
USING (public.is_trip_member(id, ARRAY['editor']));

CREATE POLICY "Members update their trips"
ON public.trips FOR UPDATE TO authenticated
USING (public.is_trip_member(id, ARRAY['editor']))
WITH CHECK (public.is_trip_member(id, ARRAY['editor']));

-- Owner-only fields stay owner-only even though RLS cannot scope columns.
CREATE OR REPLACE FUNCTION public.guard_trip_owner_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = OLD.user_id THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.visibility IS DISTINCT FROM OLD.visibility
     OR NEW.template_id IS DISTINCT FROM OLD.template_id
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
     OR NEW.locked_snapshot IS DISTINCT FROM OLD.locked_snapshot
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only the trip creator can change this trip''s settings';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trips_guard_owner_fields
BEFORE UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.guard_trip_owner_fields();

-- Every content change is attributed and reversible. Keeps the last 200
-- entries per trip so an autosaving editor cannot grow the table without end.
CREATE OR REPLACE FUNCTION public.log_trip_content_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  configured text := current_setting('app.actor_id', true);
  before_blocks jsonb := COALESCE(OLD.content -> 'blocks', '[]'::jsonb);
  after_blocks jsonb := COALESCE(NEW.content -> 'blocks', '[]'::jsonb);
  before_n integer := jsonb_array_length(before_blocks);
  after_n integer := jsonb_array_length(after_blocks);
BEGIN
  IF NEW.content IS NOT DISTINCT FROM OLD.content THEN
    RETURN NEW;
  END IF;
  IF actor IS NULL AND configured IS NOT NULL AND configured <> '' THEN
    BEGIN
      actor := configured::uuid;
    EXCEPTION WHEN others THEN
      actor := NULL;
    END;
  END IF;
  INSERT INTO public.trip_changes (
    trip_id, actor_id, actor_kind, action, before, after, added_count, removed_count
  ) VALUES (
    NEW.id,
    actor,
    CASE WHEN actor IS NULL THEN 'system' ELSE 'user' END,
    CASE WHEN after_n > before_n THEN 'add' WHEN after_n < before_n THEN 'delete' ELSE 'edit' END,
    OLD.content,
    NEW.content,
    GREATEST(after_n - before_n, 0),
    GREATEST(before_n - after_n, 0)
  );
  DELETE FROM public.trip_changes c
  WHERE c.trip_id = NEW.id
    AND c.id IN (
      SELECT id FROM public.trip_changes
      WHERE trip_id = NEW.id
      ORDER BY created_at DESC
      OFFSET 200
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trips_log_content_change
AFTER UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.log_trip_content_change();

CREATE TRIGGER trip_members_set_updated_at
BEFORE UPDATE ON public.trip_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill: one owner row per existing trip.
INSERT INTO public.trip_members (trip_id, user_id, email, role, status, source, invited_by, joined_at)
SELECT t.id, t.user_id, COALESCE(u.email, 'owner@unknown.invalid'), 'owner', 'active', 'owner', t.user_id, t.created_at
FROM public.trips t
LEFT JOIN auth.users u ON u.id = t.user_id
ON CONFLICT DO NOTHING;