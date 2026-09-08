CREATE TABLE IF NOT EXISTS public.brains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  system_prompt text NOT NULL DEFAULT '',
  file_ids uuid[] NOT NULL DEFAULT '{}',
  category text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brains TO authenticated;
GRANT ALL ON public.brains TO service_role;

ALTER TABLE public.brains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own brains" ON public.brains;
CREATE POLICY "Users manage their own brains"
ON public.brains FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS brains_user_idx ON public.brains(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS brains_active_idx ON public.brains(user_id) WHERE is_active;

CREATE TRIGGER update_brains_updated_at
BEFORE UPDATE ON public.brains
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();