REVOKE ALL ON FUNCTION public.guard_trip_owner_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_trip_content_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_trip_member(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_trip_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_trip_member(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_trip_owner(uuid) TO authenticated, service_role;