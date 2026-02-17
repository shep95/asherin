
-- Fix teams SELECT policy: allow owner to see their team even before being added as member
DROP POLICY IF EXISTS "Team members can view team" ON public.teams;
CREATE POLICY "Team members or owner can view team"
  ON public.teams FOR SELECT
  USING (owner_id = auth.uid() OR is_team_member(auth.uid(), id));

-- Fix team_members INSERT: only allow owner/admin to add members, OR user adding themselves as owner of a team they own
DROP POLICY IF EXISTS "Admin can manage members" ON public.team_members;
CREATE POLICY "Owner/admin can add members or self-add as owner"
  ON public.team_members FOR INSERT
  WITH CHECK (
    (get_team_role(auth.uid(), team_id) = ANY (ARRAY['owner'::text, 'admin'::text]))
    OR (
      auth.uid() = user_id 
      AND role = 'owner' 
      AND EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid())
    )
  );
