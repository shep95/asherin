CREATE TABLE public.sentinel_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  case_reference TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'none',
  score INTEGER NOT NULL DEFAULT 0,
  posture TEXT NOT NULL DEFAULT 'undetermined',
  headline TEXT,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  case_file JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_sentinel_cases_user_created ON public.sentinel_cases (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sentinel_cases TO authenticated;
GRANT ALL ON public.sentinel_cases TO service_role;

ALTER TABLE public.sentinel_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own sentinel cases"
  ON public.sentinel_cases FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_sentinel_cases_updated_at
  BEFORE UPDATE ON public.sentinel_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();