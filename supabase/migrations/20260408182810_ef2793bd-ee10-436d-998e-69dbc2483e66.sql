
-- Zerlal Projects
CREATE TABLE public.zerlal_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  repo_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'upload',
  language TEXT DEFAULT 'Unknown',
  risk_grade TEXT DEFAULT 'F',
  last_scan_at TIMESTAMPTZ,
  scan_duration INTEGER,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  low_count INTEGER DEFAULT 0,
  info_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle',
  file_size BIGINT DEFAULT 0,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zerlal_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own zerlal projects" ON public.zerlal_projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Zerlal Scans
CREATE TABLE public.zerlal_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.zerlal_projects(id) ON DELETE CASCADE,
  scan_profile TEXT DEFAULT 'security-audit',
  status TEXT DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration INTEGER,
  findings_count INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  low_count INTEGER DEFAULT 0,
  info_count INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zerlal_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own zerlal scans" ON public.zerlal_scans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Zerlal Findings
CREATE TABLE public.zerlal_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.zerlal_projects(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES public.zerlal_scans(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  file_path TEXT,
  line_number INTEGER,
  category TEXT DEFAULT 'logic',
  confidence INTEGER DEFAULT 50,
  age_days INTEGER DEFAULT 0,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  assignee TEXT,
  status TEXT DEFAULT 'open',
  cwe_id TEXT,
  cvss_score NUMERIC(3,1) DEFAULT 0,
  description TEXT,
  impact TEXT,
  exploitation_steps JSONB DEFAULT '[]'::jsonb,
  code_snippet TEXT,
  suggested_fix TEXT,
  dataflow_trace JSONB DEFAULT '[]'::jsonb,
  chained_with TEXT[] DEFAULT '{}',
  compliance_controls TEXT[] DEFAULT '{}',
  similar_cves TEXT[] DEFAULT '{}',
  is_false_positive BOOLEAN DEFAULT false,
  waiver_reason TEXT,
  waived_by TEXT,
  waived_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zerlal_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own zerlal findings" ON public.zerlal_findings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Zerlal Compliance Mappings
CREATE TABLE public.zerlal_compliance_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  finding_id UUID REFERENCES public.zerlal_findings(id) ON DELETE CASCADE,
  framework TEXT NOT NULL,
  control_id TEXT NOT NULL,
  control_name TEXT,
  status TEXT DEFAULT 'non-compliant',
  evidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zerlal_compliance_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own compliance mappings" ON public.zerlal_compliance_mappings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Zerlal SBOM Components
CREATE TABLE public.zerlal_sbom_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.zerlal_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT,
  ecosystem TEXT,
  license TEXT,
  is_direct BOOLEAN DEFAULT true,
  is_vulnerable BOOLEAN DEFAULT false,
  cve_ids TEXT[] DEFAULT '{}',
  origin_country TEXT,
  maintainer_status TEXT DEFAULT 'active',
  last_update TEXT,
  risk_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zerlal_sbom_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sbom components" ON public.zerlal_sbom_components FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_zerlal_findings_project ON public.zerlal_findings(project_id);
CREATE INDEX idx_zerlal_findings_severity ON public.zerlal_findings(severity);
CREATE INDEX idx_zerlal_findings_status ON public.zerlal_findings(status);
CREATE INDEX idx_zerlal_scans_project ON public.zerlal_scans(project_id);
CREATE INDEX idx_zerlal_projects_user ON public.zerlal_projects(user_id);

-- Triggers
CREATE TRIGGER update_zerlal_projects_updated_at
  BEFORE UPDATE ON public.zerlal_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zerlal_findings_updated_at
  BEFORE UPDATE ON public.zerlal_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
