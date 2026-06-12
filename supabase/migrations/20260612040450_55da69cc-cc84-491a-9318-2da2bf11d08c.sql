CREATE TABLE public.asher_code_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'idle',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_result JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asher_code_agents TO authenticated;
GRANT ALL ON public.asher_code_agents TO service_role;

ALTER TABLE public.asher_code_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own code agents"
  ON public.asher_code_agents
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_asher_code_agents_updated_at
  BEFORE UPDATE ON public.asher_code_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_asher_code_agents_user ON public.asher_code_agents(user_id, created_at DESC);
CREATE INDEX idx_asher_code_agents_session ON public.asher_code_agents(session_id) WHERE session_id IS NOT NULL;