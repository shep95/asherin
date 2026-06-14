ALTER TABLE public.zerlal_background_jobs
  ADD COLUMN IF NOT EXISTS include_workflow_function_flaws BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.zerlal_findings
  ADD COLUMN IF NOT EXISTS finding_type TEXT NOT NULL DEFAULT 'security'
    CHECK (finding_type IN ('security','workflow-function'));

CREATE INDEX IF NOT EXISTS idx_zerlal_findings_finding_type
  ON public.zerlal_findings(project_id, finding_type);