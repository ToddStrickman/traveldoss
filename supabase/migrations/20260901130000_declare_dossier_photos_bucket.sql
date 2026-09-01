-- Phase 2 setup (backend audit, 2026-08-31).
--
-- Dossier photo uploads (src/lib/skins/shared/views/DayPhotoUploader.tsx)
-- write to the storage bucket `dossier-photos`, and 20260717193910 attaches
-- four owner-scoped RLS policies to it. But the bucket itself was created by
-- hand in the Supabase dashboard and never declared here, so a database
-- rebuilt from these migrations (staging copy, disaster recovery, a fresh
-- Lovable environment) has the policies and no bucket: uploads fail with
-- "Bucket not found". This makes the recipe complete.
--
-- ON CONFLICT DO NOTHING: on the live project the bucket already exists and
-- keeps whatever settings it has; only a fresh environment takes these
-- defaults. Private: photos are served through signed URLs, never directly.
insert into storage.buckets (id, name, public)
values ('dossier-photos', 'dossier-photos', false)
on conflict (id) do nothing;
