LOCK TABLE public.trip_members, public.trip_invites IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.trip_members
    WHERE btrim(email) = '' OR lower(btrim(email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) THEN
    RAISE EXCEPTION 'trip_members contains blank or invalid email values';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.trip_invites
    WHERE btrim(email) = '' OR lower(btrim(email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) THEN
    RAISE EXCEPTION 'trip_invites contains blank or invalid email values';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.trip_members
    GROUP BY trip_id, lower(btrim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'trip_members contains canonical email collisions';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.trip_invites
    WHERE accepted_at IS NULL AND revoked_at IS NULL
    GROUP BY trip_id, lower(btrim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'trip_invites contains multiple live invitations for a canonical email';
  END IF;
END;
$$;

UPDATE public.trip_members SET email = lower(btrim(email)) WHERE email IS DISTINCT FROM lower(btrim(email));
UPDATE public.trip_invites SET email = lower(btrim(email)) WHERE email IS DISTINCT FROM lower(btrim(email));

DROP INDEX public.trip_members_trip_email_key;
ALTER TABLE public.trip_members
  ADD CONSTRAINT trip_members_trip_email_key UNIQUE (trip_id, email),
  ADD CONSTRAINT trip_members_email_canonical CHECK (email = lower(btrim(email)) AND email <> '');
ALTER TABLE public.trip_invites
  ADD COLUMN accepted_by uuid,
  ADD CONSTRAINT trip_invites_email_canonical CHECK (email = lower(btrim(email)) AND email <> '');
CREATE UNIQUE INDEX trip_invites_one_live_email_key
  ON public.trip_invites (trip_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.create_trip_invite(
  p_trip_id uuid,
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS TABLE(invite_id uuid, member_id uuid, email text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  v_member public.trip_members%ROWTYPE;
  v_invite public.trip_invites%ROWTYPE;
  v_owner_email text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF v_email = '' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid invitation email' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at <= now() THEN RAISE EXCEPTION 'Invitation expiry must be in the future' USING ERRCODE = '22023'; END IF;

  PERFORM 1 FROM public.trips WHERE id = p_trip_id AND user_id = v_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the trip creator can do this' USING ERRCODE = '42501'; END IF;

  SELECT lower(btrim(u.email)) INTO v_owner_email FROM auth.users u WHERE u.id = v_actor;
  IF v_owner_email = v_email THEN RAISE EXCEPTION 'The trip creator is already on this trip' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_member FROM public.trip_members
  WHERE trip_id = p_trip_id AND email = v_email FOR UPDATE;
  IF FOUND AND (v_member.role = 'owner' OR v_member.status = 'active') THEN
    RAISE EXCEPTION 'This person is already on the trip' USING ERRCODE = '23505';
  END IF;

  UPDATE public.trip_invites
  SET revoked_at = now()
  WHERE trip_id = p_trip_id AND email = v_email
    AND accepted_at IS NULL AND revoked_at IS NULL;

  INSERT INTO public.trip_members (trip_id, email, role, status, source, invited_by)
  VALUES (p_trip_id, v_email, 'editor', 'invited', 'creator_invite', v_actor)
  ON CONFLICT (trip_id, email) DO UPDATE
  SET role = 'editor', status = 'invited', source = 'creator_invite', invited_by = v_actor,
      user_id = NULL, joined_at = NULL, updated_at = now()
  WHERE trip_members.role <> 'owner' AND trip_members.status <> 'active'
  RETURNING * INTO v_member;
  IF v_member.id IS NULL THEN RAISE EXCEPTION 'This person is already on the trip' USING ERRCODE = '23505'; END IF;

  INSERT INTO public.trip_invites (trip_id, email, token_hash, invited_by, expires_at)
  VALUES (p_trip_id, v_email, p_token_hash, v_actor, p_expires_at)
  RETURNING * INTO v_invite;

  RETURN QUERY SELECT v_invite.id, v_member.id, v_email, v_invite.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_trip_invite(p_token_hash text)
RETURNS TABLE(trip_id uuid, slug text, created_at timestamptz, already_accepted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_invite public.trip_invites%ROWTYPE;
  v_member public.trip_members%ROWTYPE;
  v_slug text;
BEGIN
  IF v_actor IS NULL OR v_email = '' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_invite FROM public.trip_invites
  WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This invitation link is not valid' USING ERRCODE = '22023'; END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    IF v_invite.accepted_by = v_actor AND v_invite.email = v_email AND EXISTS (
      SELECT 1 FROM public.trip_members m
      WHERE m.trip_id = v_invite.trip_id AND m.email = v_email
        AND m.user_id = v_actor AND m.status = 'active'
    ) THEN
      SELECT t.slug INTO v_slug FROM public.trips t WHERE t.id = v_invite.trip_id;
      RETURN QUERY SELECT v_invite.trip_id, v_slug, v_invite.created_at, true;
      RETURN;
    END IF;
    RAISE EXCEPTION 'This invitation has already been used' USING ERRCODE = '22023';
  END IF;
  IF v_invite.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This invitation was withdrawn' USING ERRCODE = '22023'; END IF;
  IF v_invite.expires_at <= now() THEN RAISE EXCEPTION 'This invitation has expired' USING ERRCODE = '22023'; END IF;
  IF v_invite.email <> v_email THEN
    RAISE EXCEPTION 'This invitation was sent to a different address' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_member FROM public.trip_members
  WHERE trip_id = v_invite.trip_id AND email = v_email FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The invitation roster entry is missing' USING ERRCODE = 'P0001'; END IF;
  IF v_member.role = 'owner' THEN RAISE EXCEPTION 'The trip creator is already on this trip' USING ERRCODE = '22023'; END IF;
  IF v_member.user_id IS NOT NULL AND v_member.user_id <> v_actor THEN
    RAISE EXCEPTION 'This invitation is bound to another account' USING ERRCODE = '42501';
  END IF;
  IF v_member.status = 'removed' THEN
    RAISE EXCEPTION 'This invitation is no longer active' USING ERRCODE = '22023';
  END IF;

  UPDATE public.trip_members
  SET user_id = v_actor, role = 'editor', status = 'active',
      joined_at = coalesce(joined_at, now()), updated_at = now()
  WHERE id = v_member.id;

  UPDATE public.trip_invites
  SET accepted_at = now(), accepted_by = v_actor
  WHERE id = v_invite.id;

  SELECT t.slug INTO v_slug FROM public.trips t WHERE t.id = v_invite.trip_id;
  RETURN QUERY SELECT v_invite.trip_id, v_slug, v_invite.created_at, false;
END;
$$;

REVOKE ALL ON FUNCTION public.create_trip_invite(uuid, text, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_trip_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_trip_invite(uuid, text, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_trip_invite(text) TO authenticated, service_role;