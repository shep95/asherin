
-- Investigation annotations for living dossier (Gap 3)
CREATE TABLE public.investigation_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.nomad_investigations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  finding_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEEDS_VERIFICATION' CHECK (status IN ('VERIFIED', 'FALSE_POSITIVE', 'NEEDS_VERIFICATION')),
  user_note TEXT DEFAULT '',
  confidence_override NUMERIC(4,2),
  added_sources TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.investigation_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own annotations"
  ON public.investigation_annotations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Source telemetry tracking (Gap 4)
CREATE TABLE public.nomad_source_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investigation_id UUID REFERENCES public.nomad_investigations(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL,
  response_time_ms INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'TIMEOUT', 'RATE_LIMITED', 'NO_RESULTS', 'ERROR')),
  result_count INTEGER DEFAULT 0,
  entity_yield INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nomad_source_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own telemetry"
  ON public.nomad_source_telemetry FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Calibration events for confidence feedback loop (Gap 6)
CREATE TABLE public.nomad_calibration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investigation_id UUID REFERENCES public.nomad_investigations(id) ON DELETE SET NULL,
  finding_text TEXT NOT NULL,
  ai_confidence NUMERIC(4,2) NOT NULL,
  user_verdict TEXT NOT NULL DEFAULT 'CORRECT' CHECK (user_verdict IN ('CORRECT', 'INCORRECT', 'PARTIAL')),
  entity_type TEXT,
  source_tiers INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nomad_calibration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calibration"
  ON public.nomad_calibration_events FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add columns to nomad_investigations for persistence (Gap 1) and diff (Gap 8)
ALTER TABLE public.nomad_investigations
  ADD COLUMN IF NOT EXISTS subject_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS esrc_profile JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dark_zones TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_telemetry JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS pivot_suggestions JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS actionable_intel JSONB DEFAULT '{}';

-- Index for cross-investigation lookups
CREATE INDEX IF NOT EXISTS idx_nomad_investigations_fingerprint 
  ON public.nomad_investigations(subject_fingerprint);

CREATE INDEX IF NOT EXISTS idx_nomad_source_telemetry_source
  ON public.nomad_source_telemetry(source_name, user_id);

CREATE INDEX IF NOT EXISTS idx_investigation_annotations_inv
  ON public.investigation_annotations(investigation_id);
