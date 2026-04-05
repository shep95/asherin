
CREATE TABLE public.axrlen_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Analysis',
  region TEXT,
  prediction_type TEXT NOT NULL DEFAULT 'comprehensive',
  status TEXT NOT NULL DEFAULT 'processing',
  predictions JSONB,
  resource_analysis JSONB,
  threat_assessment JSONB,
  policy_simulations JSONB,
  timeline_divergences JSONB,
  data_sources JSONB,
  confidence_score NUMERIC,
  ai_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.axrlen_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own axrlen sessions"
  ON public.axrlen_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own axrlen sessions"
  ON public.axrlen_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own axrlen sessions"
  ON public.axrlen_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own axrlen sessions"
  ON public.axrlen_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_axrlen_sessions_updated_at
  BEFORE UPDATE ON public.axrlen_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
