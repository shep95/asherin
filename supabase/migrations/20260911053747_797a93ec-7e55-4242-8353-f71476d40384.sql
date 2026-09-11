ALTER TABLE public.software_artifact_file
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'user';

ALTER TABLE public.software_artifact_file
  DROP CONSTRAINT IF EXISTS software_artifact_file_origin_check;
ALTER TABLE public.software_artifact_file
  ADD CONSTRAINT software_artifact_file_origin_check CHECK (origin IN ('user','ai','system'));

CREATE INDEX IF NOT EXISTS software_artifact_file_live_idx
  ON public.software_artifact_file (artifact_id, deleted_at);

ALTER TABLE public.software_artifact_version
  ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS upstream_artifact_id UUID,
  ADD COLUMN IF NOT EXISTS upstream_version_id UUID;

CREATE TABLE IF NOT EXISTS public.software_artifact_draft (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, owner_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_artifact_draft TO authenticated;
GRANT ALL ON public.software_artifact_draft TO service_role;
ALTER TABLE public.software_artifact_draft ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read your own artifact drafts" ON public.software_artifact_draft;
CREATE POLICY "read your own artifact drafts" ON public.software_artifact_draft
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() AND public.software_artifact_role(artifact_id, auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS "contributors write their drafts" ON public.software_artifact_draft;
CREATE POLICY "contributors write their drafts" ON public.software_artifact_draft
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND public.software_can_contribute(artifact_id, auth.uid()));
DROP POLICY IF EXISTS "contributors update their drafts" ON public.software_artifact_draft;
CREATE POLICY "contributors update their drafts" ON public.software_artifact_draft
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() AND public.software_can_contribute(artifact_id, auth.uid()))
  WITH CHECK (owner_user_id = auth.uid() AND public.software_can_contribute(artifact_id, auth.uid()));
DROP POLICY IF EXISTS "contributors delete their drafts" ON public.software_artifact_draft;
CREATE POLICY "contributors delete their drafts" ON public.software_artifact_draft
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

DROP TRIGGER IF EXISTS software_artifact_draft_owner ON public.software_artifact_draft;
CREATE TRIGGER software_artifact_draft_owner BEFORE INSERT ON public.software_artifact_draft
  FOR EACH ROW EXECUTE FUNCTION public.software_force_owner();
DROP TRIGGER IF EXISTS software_artifact_draft_touch ON public.software_artifact_draft;
CREATE TRIGGER software_artifact_draft_touch BEFORE UPDATE ON public.software_artifact_draft
  FOR EACH ROW EXECUTE FUNCTION public.software_touch_updated_at();