
-- Branches table for Asher Code IDE
CREATE TABLE IF NOT EXISTS public.asher_code_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.asher_code_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_branch_id uuid REFERENCES public.asher_code_branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_asher_code_branches_project ON public.asher_code_branches(project_id);

ALTER TABLE public.asher_code_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asher_code_branches_owner_all" ON public.asher_code_branches
  USING (EXISTS (SELECT 1 FROM public.asher_code_projects p
    WHERE p.id = asher_code_branches.project_id
      AND (p.owner_id = auth.uid() OR public.is_asher_super_owner(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.asher_code_projects p
    WHERE p.id = asher_code_branches.project_id
      AND (p.owner_id = auth.uid() OR public.is_asher_super_owner(auth.uid()))));

-- Add branch_id to files (NULL = main/default branch for backward compat)
ALTER TABLE public.asher_code_files
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.asher_code_branches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_asher_code_files_branch ON public.asher_code_files(branch_id);

-- Replace unique constraint to include branch_id
ALTER TABLE public.asher_code_files DROP CONSTRAINT IF EXISTS asher_code_files_project_id_path_key;
CREATE UNIQUE INDEX IF NOT EXISTS asher_code_files_project_branch_path_key
  ON public.asher_code_files (project_id, COALESCE(branch_id::text, ''), path);
