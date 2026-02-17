
-- Fix infinite recursion: notebook_shares RLS references notebooks, and notebooks RLS references notebook_shares
-- Solution: use security definer functions

-- Function to check if user has access to a notebook (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_notebook_owner(_user_id uuid, _notebook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notebooks WHERE id = _notebook_id AND owner_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_notebook_share(_user_id uuid, _notebook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notebook_shares WHERE notebook_id = _notebook_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.notebook_team_id(_notebook_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.notebooks WHERE id = _notebook_id LIMIT 1;
$$;

-- Drop and recreate notebooks policies
DROP POLICY IF EXISTS "Owner can manage notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Shared users can view notebooks" ON public.notebooks;

CREATE POLICY "Owner can manage notebooks" ON public.notebooks
FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Shared users can view notebooks" ON public.notebooks
FOR SELECT USING (
  has_notebook_share(auth.uid(), id)
  OR ((team_id IS NOT NULL) AND is_team_member(auth.uid(), team_id))
);

-- Fix notebook_cells policies to use security definer
DROP POLICY IF EXISTS "Notebook owner can manage cells" ON public.notebook_cells;
DROP POLICY IF EXISTS "Shared users can view cells" ON public.notebook_cells;

CREATE POLICY "Notebook owner can manage cells" ON public.notebook_cells
FOR ALL USING (is_notebook_owner(auth.uid(), notebook_id))
WITH CHECK (is_notebook_owner(auth.uid(), notebook_id));

CREATE POLICY "Shared users can view cells" ON public.notebook_cells
FOR SELECT USING (
  has_notebook_share(auth.uid(), notebook_id)
  OR (notebook_team_id(notebook_id) IS NOT NULL AND is_team_member(auth.uid(), notebook_team_id(notebook_id)))
);

-- Fix notebook_shares policies
DROP POLICY IF EXISTS "Notebook owner can manage shares" ON public.notebook_shares;

CREATE POLICY "Notebook owner can manage shares" ON public.notebook_shares
FOR ALL USING (is_notebook_owner(auth.uid(), notebook_id))
WITH CHECK (is_notebook_owner(auth.uid(), notebook_id));

-- Fix notebook_versions policies
DROP POLICY IF EXISTS "Notebook participants can view versions" ON public.notebook_versions;

CREATE POLICY "Notebook participants can view versions" ON public.notebook_versions
FOR SELECT USING (
  is_notebook_owner(auth.uid(), notebook_id)
  OR has_notebook_share(auth.uid(), notebook_id)
  OR (notebook_team_id(notebook_id) IS NOT NULL AND is_team_member(auth.uid(), notebook_team_id(notebook_id)))
);

-- Fix notebook_comments policies
DROP POLICY IF EXISTS "Notebook participants can view comments" ON public.notebook_comments;

CREATE POLICY "Notebook participants can view comments" ON public.notebook_comments
FOR SELECT USING (
  is_notebook_owner(auth.uid(), notebook_id)
  OR has_notebook_share(auth.uid(), notebook_id)
  OR (notebook_team_id(notebook_id) IS NOT NULL AND is_team_member(auth.uid(), notebook_team_id(notebook_id)))
);
