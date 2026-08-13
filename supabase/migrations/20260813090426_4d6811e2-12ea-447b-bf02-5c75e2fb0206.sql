CREATE TABLE IF NOT EXISTS public.asherin_dork_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host text NOT NULL,
  pack jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.asherin_dork_packs TO authenticated;
GRANT ALL ON public.asherin_dork_packs TO service_role;
ALTER TABLE public.asherin_dork_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own packs read" ON public.asherin_dork_packs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own packs insert" ON public.asherin_dork_packs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS asherin_dork_packs_user_host_idx
  ON public.asherin_dork_packs(user_id, host, created_at DESC);