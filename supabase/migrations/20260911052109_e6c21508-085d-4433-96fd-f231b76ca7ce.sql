-- Phase 1 completion: artifact files, checks and check runs

CREATE TABLE public.software_artifact_file (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  path TEXT NOT NULL CHECK (length(path) BETWEEN 1 AND 240 AND path NOT LIKE '%..%'),
  content TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT 'text/plain',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_artifact_file TO authenticated;
GRANT ALL ON public.software_artifact_file TO service_role;
ALTER TABLE public.software_artifact_file ENABLE ROW LEVEL SECURITY;
CREATE INDEX software_artifact_file_artifact_idx ON public.software_artifact_file (artifact_id, path);

CREATE POLICY "read files of artifacts you can see" ON public.software_artifact_file
  FOR SELECT TO authenticated
  USING (public.software_artifact_role(artifact_id, auth.uid()) IS NOT NULL);
CREATE POLICY "contributors write files" ON public.software_artifact_file
  FOR INSERT TO authenticated
  WITH CHECK (public.software_can_contribute(artifact_id, auth.uid()));
CREATE POLICY "contributors update files" ON public.software_artifact_file
  FOR UPDATE TO authenticated
  USING (public.software_can_contribute(artifact_id, auth.uid()))
  WITH CHECK (public.software_can_contribute(artifact_id, auth.uid()));
CREATE POLICY "contributors delete files" ON public.software_artifact_file
  FOR DELETE TO authenticated
  USING (public.software_can_contribute(artifact_id, auth.uid()));

CREATE TABLE public.software_artifact_check (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('no_runtime_error','no_console_error','console_contains','dom_selector_exists','dom_text_contains')),
  expectation TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_artifact_check TO authenticated;
GRANT ALL ON public.software_artifact_check TO service_role;
ALTER TABLE public.software_artifact_check ENABLE ROW LEVEL SECURITY;
CREATE INDEX software_artifact_check_artifact_idx ON public.software_artifact_check (artifact_id);

CREATE POLICY "read checks of artifacts you can see" ON public.software_artifact_check
  FOR SELECT TO authenticated
  USING (public.software_artifact_role(artifact_id, auth.uid()) IS NOT NULL);
CREATE POLICY "contributors add checks" ON public.software_artifact_check
  FOR INSERT TO authenticated
  WITH CHECK (public.software_can_contribute(artifact_id, auth.uid()));
CREATE POLICY "contributors update checks" ON public.software_artifact_check
  FOR UPDATE TO authenticated
  USING (public.software_can_contribute(artifact_id, auth.uid()))
  WITH CHECK (public.software_can_contribute(artifact_id, auth.uid()));
CREATE POLICY "contributors delete checks" ON public.software_artifact_check
  FOR DELETE TO authenticated
  USING (public.software_can_contribute(artifact_id, auth.uid()));

CREATE TABLE public.software_artifact_run (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  version_id UUID REFERENCES public.software_artifact_version(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','passed','failed','unavailable')),
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  observations JSONB NOT NULL DEFAULT '[]'::jsonb,
  unavailable_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_artifact_run TO authenticated;
GRANT ALL ON public.software_artifact_run TO service_role;
ALTER TABLE public.software_artifact_run ENABLE ROW LEVEL SECURITY;
CREATE INDEX software_artifact_run_artifact_idx ON public.software_artifact_run (artifact_id, created_at DESC);

CREATE POLICY "read runs of artifacts you can see" ON public.software_artifact_run
  FOR SELECT TO authenticated
  USING (public.software_artifact_role(artifact_id, auth.uid()) IS NOT NULL);
CREATE POLICY "contributors record runs" ON public.software_artifact_run
  FOR INSERT TO authenticated
  WITH CHECK (public.software_can_contribute(artifact_id, auth.uid()));
CREATE POLICY "contributors update runs" ON public.software_artifact_run
  FOR UPDATE TO authenticated
  USING (public.software_can_contribute(artifact_id, auth.uid()))
  WITH CHECK (public.software_can_contribute(artifact_id, auth.uid()));
CREATE POLICY "contributors delete runs" ON public.software_artifact_run
  FOR DELETE TO authenticated
  USING (public.software_can_contribute(artifact_id, auth.uid()));

CREATE TRIGGER software_artifact_file_owner BEFORE INSERT ON public.software_artifact_file
  FOR EACH ROW EXECUTE FUNCTION public.software_force_owner();
CREATE TRIGGER software_artifact_check_owner BEFORE INSERT ON public.software_artifact_check
  FOR EACH ROW EXECUTE FUNCTION public.software_force_owner();
CREATE TRIGGER software_artifact_run_owner BEFORE INSERT ON public.software_artifact_run
  FOR EACH ROW EXECUTE FUNCTION public.software_force_owner();

CREATE TRIGGER software_artifact_file_touch BEFORE UPDATE ON public.software_artifact_file
  FOR EACH ROW EXECUTE FUNCTION public.software_touch_updated_at();
CREATE TRIGGER software_artifact_check_touch BEFORE UPDATE ON public.software_artifact_check
  FOR EACH ROW EXECUTE FUNCTION public.software_touch_updated_at();
CREATE TRIGGER software_artifact_run_touch BEFORE UPDATE ON public.software_artifact_run
  FOR EACH ROW EXECUTE FUNCTION public.software_touch_updated_at();