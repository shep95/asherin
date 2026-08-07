-- ═══════════════════════════════════════════════════════════════════════
-- RESUME & JOB OPERATOR — storage layer
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE public.user_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'My Resume',
  source_filename text,
  raw_text text NOT NULL DEFAULT '',
  structured jsonb NOT NULL DEFAULT '{}'::jsonb,
  psychology jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_resumes TO authenticated;
GRANT ALL ON public.user_resumes TO service_role;
ALTER TABLE public.user_resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resumes_owner_all" ON public.user_resumes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_user_resumes_user ON public.user_resumes (user_id, updated_at DESC);

CREATE TABLE public.resume_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  structured jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_text text NOT NULL DEFAULT '',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_versions TO authenticated;
GRANT ALL ON public.resume_versions TO service_role;
ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resume_versions_owner_all" ON public.resume_versions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_resume_versions_resume ON public.resume_versions (resume_id, version DESC);

CREATE TABLE public.resume_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_id uuid REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  question text NOT NULL,
  why text,
  answer text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_gaps TO authenticated;
GRANT ALL ON public.resume_gaps TO service_role;
ALTER TABLE public.resume_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resume_gaps_owner_all" ON public.resume_gaps FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX idx_resume_gaps_unique ON public.resume_gaps (user_id, coalesce(resume_id, '00000000-0000-0000-0000-000000000000'::uuid), field_key);

CREATE TABLE public.job_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  title text NOT NULL,
  company text,
  location text,
  lat double precision,
  lng double precision,
  distance_miles numeric,
  walkable boolean NOT NULL DEFAULT false,
  url text,
  apply_email text,
  description text,
  match_score integer NOT NULL DEFAULT 0,
  match_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'new',
  discovered_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_leads TO authenticated;
GRANT ALL ON public.job_leads TO service_role;
ALTER TABLE public.job_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_leads_owner_all" ON public.job_leads FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_job_leads_user ON public.job_leads (user_id, discovered_at DESC);
CREATE UNIQUE INDEX idx_job_leads_dedupe ON public.job_leads (user_id, md5(lower(coalesce(url, title || coalesce(company,'')))));

CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.job_leads(id) ON DELETE SET NULL,
  resume_id uuid REFERENCES public.user_resumes(id) ON DELETE SET NULL,
  tailored_resume text,
  cover_letter text,
  method text NOT NULL DEFAULT 'manual',
  sent_to text,
  status text NOT NULL DEFAULT 'prepared',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_applications_owner_all" ON public.job_applications FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_job_applications_user ON public.job_applications (user_id, created_at DESC);

CREATE TABLE public.job_sentinel_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  home_label text,
  home_lat double precision,
  home_lng double precision,
  radius_miles numeric NOT NULL DEFAULT 5,
  walk_radius_miles numeric NOT NULL DEFAULT 1,
  keywords text[] NOT NULL DEFAULT ARRAY[]::text[],
  autonomous boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_sentinel_settings TO authenticated;
GRANT ALL ON public.job_sentinel_settings TO service_role;
ALTER TABLE public.job_sentinel_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_sentinel_owner_all" ON public.job_sentinel_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_resumes_touch BEFORE UPDATE ON public.user_resumes
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_job_sentinel_touch BEFORE UPDATE ON public.job_sentinel_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();