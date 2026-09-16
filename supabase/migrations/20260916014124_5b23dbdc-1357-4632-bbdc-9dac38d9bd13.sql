CREATE TABLE public.ai_usage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  function_name TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost_usd NUMERIC(12,6),
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own usage events" ON public.ai_usage_events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX ai_usage_events_user_created_idx ON public.ai_usage_events (user_id, created_at DESC);
CREATE INDEX ai_usage_events_user_tool_idx ON public.ai_usage_events (user_id, tool);

CREATE TABLE public.tool_api_switches (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  monthly_budget_usd NUMERIC(12,2),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tool)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_api_switches TO authenticated;
GRANT ALL ON public.tool_api_switches TO service_role;

ALTER TABLE public.tool_api_switches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own tool switches" ON public.tool_api_switches
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);