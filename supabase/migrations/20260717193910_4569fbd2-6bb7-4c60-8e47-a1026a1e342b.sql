
-- Users manage their own files under `{auth.uid()}/...` in the dossier-photos bucket.
CREATE POLICY "Users read own dossier photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dossier-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users upload own dossier photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dossier-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users update own dossier photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dossier-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users delete own dossier photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dossier-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
