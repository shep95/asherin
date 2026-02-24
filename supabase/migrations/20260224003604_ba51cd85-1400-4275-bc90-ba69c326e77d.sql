
-- Oracle Locus: Analysis history + user corrections
CREATE TABLE public.oracle_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  confidence_score INTEGER DEFAULT 0,
  error_radius_meters INTEGER DEFAULT 0,
  macro_region TEXT,
  address_estimate TEXT,
  rationale JSONB DEFAULT '[]'::jsonb,
  identified_features JSONB DEFAULT '[]'::jsonb,
  alternative_locations JSONB DEFAULT '[]'::jsonb,
  time_estimation JSONB DEFAULT '{}'::jsonb,
  person_analysis JSONB DEFAULT '[]'::jsonb,
  insufficient_data BOOLEAN DEFAULT false,
  insufficient_data_reason TEXT,
  -- Iterative refinement data
  refinement_steps JSONB DEFAULT '[]'::jsonb,
  -- User feedback
  user_verified BOOLEAN,
  user_correct BOOLEAN,
  actual_latitude DOUBLE PRECISION,
  actual_longitude DOUBLE PRECISION,
  distance_error_km DOUBLE PRECISION,
  user_notes TEXT,
  -- Calibration
  calibrated_confidence INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.oracle_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own oracle_analyses"
ON public.oracle_analyses FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Self-Learning Loop: Circuit breaker tracking columns on existing cron settings
-- Add columns to self_learning_cron_settings
ALTER TABLE public.self_learning_cron_settings
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_consecutive_failures INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS max_iterations_per_day INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS iterations_today INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iterations_reset_date DATE DEFAULT CURRENT_DATE;

-- Self-Learning Loop: Brain metrics for effectiveness tracking
ALTER TABLE public.self_learning_brains
  ADD COLUMN IF NOT EXISTS times_applied INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_helped INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_rate DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS languages_applicable TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_language_agnostic BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_version_id UUID,
  ADD COLUMN IF NOT EXISTS deprecated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deprecated_reason TEXT;
