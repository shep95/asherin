
-- Fix team_members INSERT policy to also allow users accepting a valid pending invite
DROP POLICY IF EXISTS "Owner/admin can add members or self-add as owner" ON public.team_members;
CREATE POLICY "Owner/admin can add members or self-add as owner"
  ON public.team_members FOR INSERT
  WITH CHECK (
    -- Existing: admins/owners can add anyone
    (get_team_role(auth.uid(), team_id) = ANY (ARRAY['owner'::text, 'admin'::text]))
    OR
    -- Existing: owner can self-add as owner
    (
      auth.uid() = user_id 
      AND role = 'owner' 
      AND EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid())
    )
    OR
    -- NEW: user can self-add if they have a valid pending invite for this team with matching role
    (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.team_invites ti
        WHERE ti.team_id = team_members.team_id
          AND ti.role = team_members.role
          AND ti.status = 'accepted'
          AND ti.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );
