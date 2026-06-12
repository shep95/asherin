
CREATE TABLE public.zerlal_background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  project_name text,
  scan_profile text NOT NULL DEFAULT 'security-audit',
  file_name text,
  github_url text,
  code_content text,
  recipient_email text NOT NULL,
  byok jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending | planning | scanning | finalizing | completed | failed
  scan_id uuid,
  provider_profile jsonb,
  total_sections integer NOT NULL DEFAULT 0,
  current_section integer NOT NULL DEFAULT 0,
  aggregated_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_pass_summary text,
  first_pass_risk_grade text,
  final_risk_grade text,
  final_summary text,
  findings_count integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_run_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.zerlal_background_jobs TO authenticated;
GRANT ALL ON public.zerlal_background_jobs TO service_role;

ALTER TABLE public.zerlal_background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own background jobs"
  ON public.zerlal_background_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own background jobs"
  ON public.zerlal_background_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own background jobs"
  ON public.zerlal_background_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX zerlal_bg_jobs_status_idx ON public.zerlal_background_jobs (status, last_run_at NULLS FIRST);
CREATE INDEX zerlal_bg_jobs_user_idx ON public.zerlal_background_jobs (user_id, created_at DESC);

CREATE TRIGGER zerlal_bg_jobs_touch
  BEFORE UPDATE ON public.zerlal_background_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
