-- Google Mesh: consent tier on accounts
ALTER TABLE public.google_accounts
  ADD COLUMN IF NOT EXISTS consent_tier SMALLINT NOT NULL DEFAULT 1;

-- ── Voiceprints ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_voiceprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  account_id UUID REFERENCES public.google_accounts(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  stylometry JSONB NOT NULL DEFAULT '{}'::jsonb,
  sample_count INTEGER NOT NULL DEFAULT 0,
  built_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_voiceprints TO authenticated;
GRANT ALL ON public.google_voiceprints TO service_role;
ALTER TABLE public.google_voiceprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voiceprints_owner_all" ON public.google_voiceprints
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Place nodes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_place_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  label TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  visit_count INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMP WITH TIME ZONE,
  last_seen TIMESTAMP WITH TIME ZONE,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, normalized_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_place_nodes TO authenticated;
GRANT ALL ON public.google_place_nodes TO service_role;
ALTER TABLE public.google_place_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "place_nodes_owner_all" ON public.google_place_nodes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_place_nodes_user_last_seen
  ON public.google_place_nodes (user_id, last_seen DESC);

-- ── Attention windows ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_attention_windows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  day DATE NOT NULL,
  meeting_minutes INTEGER NOT NULL DEFAULT 0,
  focus_minutes INTEGER NOT NULL DEFAULT 0,
  fragmentation NUMERIC(5,3) NOT NULL DEFAULT 0,
  first_activity_hour SMALLINT,
  last_activity_hour SMALLINT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_attention_windows TO authenticated;
GRANT ALL ON public.google_attention_windows TO service_role;
ALTER TABLE public.google_attention_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attention_owner_all" ON public.google_attention_windows
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Agency audit (append-only) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_agency_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  google_email TEXT,
  action TEXT NOT NULL,
  target TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.google_agency_audit TO authenticated;
GRANT ALL ON public.google_agency_audit TO service_role;
ALTER TABLE public.google_agency_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency_audit_owner_read" ON public.google_agency_audit
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "agency_audit_owner_insert" ON public.google_agency_audit
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_agency_audit_user_created
  ON public.google_agency_audit (user_id, created_at DESC);