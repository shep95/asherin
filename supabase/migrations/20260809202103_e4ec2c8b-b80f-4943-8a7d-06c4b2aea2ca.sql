CREATE TABLE public.postmark_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  domain text NOT NULL,
  asns jsonb NOT NULL DEFAULT '[]'::jsonb,
  countries jsonb NOT NULL DEFAULT '[]'::jsonb,
  esps jsonb NOT NULL DEFAULT '[]'::jsonb,
  mailers jsonb NOT NULL DEFAULT '[]'::jsonb,
  auth_pass_rate numeric NOT NULL DEFAULT 0,
  sample_size integer NOT NULL DEFAULT 0,
  established_at timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.postmark_baselines TO authenticated;
GRANT ALL ON public.postmark_baselines TO service_role;

ALTER TABLE public.postmark_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own sender baselines"
  ON public.postmark_baselines FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER postmark_baselines_updated_at
  BEFORE UPDATE ON public.postmark_baselines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();