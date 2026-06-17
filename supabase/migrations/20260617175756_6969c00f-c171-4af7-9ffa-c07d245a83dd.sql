
CREATE TABLE public.zaxin_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_code TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  severity TEXT NOT NULL DEFAULT 'med',
  owner TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zaxin_cases TO authenticated;
GRANT ALL ON public.zaxin_cases TO service_role;

ALTER TABLE public.zaxin_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own zaxin cases"
  ON public.zaxin_cases FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER zaxin_cases_touch_updated
  BEFORE UPDATE ON public.zaxin_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX zaxin_cases_user_created_idx ON public.zaxin_cases (user_id, created_at DESC);
