
-- Self Access Learning: codebase analysis findings
CREATE TABLE public.self_access_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  run_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  finding_type TEXT NOT NULL DEFAULT 'issue', -- issue, optimization, security, architecture, design
  severity TEXT NOT NULL DEFAULT 'medium', -- critical, high, medium, low, info
  title TEXT NOT NULL,
  finding TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  reason_needs_fix TEXT NOT NULL,
  output_code TEXT, -- the copyable code/fix output
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, dismissed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.self_access_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on self_access_findings"
  ON public.self_access_findings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Self Access Learning runs
CREATE TABLE public.self_access_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  files_analyzed INT DEFAULT 0,
  findings_count INT DEFAULT 0,
  duration_ms INT,
  scan_scope TEXT DEFAULT 'full', -- full, frontend, backend, security
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.self_access_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on self_access_runs"
  ON public.self_access_runs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
