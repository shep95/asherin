
CREATE TABLE public.zeeion_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT DEFAULT 'csv',
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'processing',
  summary JSONB,
  executive_summary TEXT,
  wasteful_items JSONB,
  savings_opportunities JSONB,
  department_performance JSONB,
  anomalies JSONB,
  category_breakdown JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.zeeion_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own zeeion sessions" ON public.zeeion_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own zeeion sessions" ON public.zeeion_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own zeeion sessions" ON public.zeeion_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own zeeion sessions" ON public.zeeion_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_zeeion_sessions_updated_at
  BEFORE UPDATE ON public.zeeion_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
