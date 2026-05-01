-- ZANOEM autopilot decision log: every choice ZANOEM made on the human's behalf
CREATE TABLE IF NOT EXISTS public.zanoem_autopilot_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  surface TEXT NOT NULL CHECK (surface IN ('asher_ide','aureon_ide','asher_zanoem')),
  project_ref TEXT,
  conversation_ref TEXT,
  round INT NOT NULL DEFAULT 1,
  trigger_excerpt TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  chosen_option TEXT,
  rationale TEXT,
  reply_sent TEXT,
  status TEXT NOT NULL DEFAULT 'committed' CHECK (status IN ('committed','overridden','reverted')),
  overridden_at TIMESTAMPTZ,
  override_choice TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zanoem_autopilot_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own decisions"
  ON public.zanoem_autopilot_decisions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own decisions"
  ON public.zanoem_autopilot_decisions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own decisions"
  ON public.zanoem_autopilot_decisions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own decisions"
  ON public.zanoem_autopilot_decisions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_zad_user_proj ON public.zanoem_autopilot_decisions(user_id, surface, project_ref, created_at DESC);

CREATE TRIGGER zad_touch_updated_at
  BEFORE UPDATE ON public.zanoem_autopilot_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();