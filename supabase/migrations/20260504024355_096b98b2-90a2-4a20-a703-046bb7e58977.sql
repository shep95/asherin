-- HISTORY REDACTION: operator mailboxes that once appeared in this file have been
-- replaced with role labels. These statements already ran; identity is now decided
-- by public.is_internal_staff/is_internal_operator (sha256 digests). Do not
-- re-add an address here — a committed mailbox is a disclosure.

-- Allow operator-four@redacted.invalid to upload (and view/update) Asher Brains, but never delete.
CREATE OR REPLACE FUNCTION public.is_asher_brain_contributor(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _uid
      AND lower(email) IN ('operator-owner@redacted.invalid', 'operator-four@redacted.invalid')
  );
$$;

-- asher_brains table policies
DROP POLICY IF EXISTS "Asher super owner can select brains" ON public.asher_brains;
DROP POLICY IF EXISTS "Asher super owner can insert brains" ON public.asher_brains;
DROP POLICY IF EXISTS "Asher super owner can update brains" ON public.asher_brains;

CREATE POLICY "Asher contributors can select brains"
  ON public.asher_brains FOR SELECT
  USING (public.is_asher_brain_contributor(auth.uid()));

CREATE POLICY "Asher contributors can insert brains"
  ON public.asher_brains FOR INSERT
  WITH CHECK (public.is_asher_brain_contributor(auth.uid()));

CREATE POLICY "Asher contributors can update brains"
  ON public.asher_brains FOR UPDATE
  USING (public.is_asher_brain_contributor(auth.uid()));
-- DELETE policy unchanged: only super owner can delete.

-- Storage bucket policies
DROP POLICY IF EXISTS "Asher super owner reads brain files" ON storage.objects;
DROP POLICY IF EXISTS "Asher super owner updates brain files" ON storage.objects;
DROP POLICY IF EXISTS "Asher super owner uploads brain files" ON storage.objects;

CREATE POLICY "Asher contributors read brain files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'asher-brains' AND public.is_asher_brain_contributor(auth.uid()));

CREATE POLICY "Asher contributors update brain files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'asher-brains' AND public.is_asher_brain_contributor(auth.uid()));

CREATE POLICY "Asher contributors upload brain files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'asher-brains' AND public.is_asher_brain_contributor(auth.uid()));
-- DELETE policy on storage unchanged: only super owner.
