DROP POLICY IF EXISTS "Invitees can view own invites" ON public.team_invites;
CREATE POLICY "Invitees can view own invites"
ON public.team_invites
FOR SELECT
TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS "Invitees can update own invites" ON public.team_invites;
CREATE POLICY "Invitees can update own invites"
ON public.team_invites
FOR UPDATE
TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
WITH CHECK (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));