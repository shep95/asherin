
CREATE TABLE public.cross_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Session',
  mode TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'active',
  duration INTEGER NOT NULL DEFAULT 0,
  frames_analyzed INTEGER NOT NULL DEFAULT 0,
  frames_skipped INTEGER NOT NULL DEFAULT 0,
  alerts_fired INTEGER NOT NULL DEFAULT 0,
  credits_used NUMERIC NOT NULL DEFAULT 0,
  ai_summary TEXT,
  tags TEXT[] DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  recording_url TEXT,
  transcript TEXT,
  psych_profiles JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cross_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cross sessions"
  ON public.cross_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cross sessions"
  ON public.cross_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cross sessions"
  ON public.cross_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cross sessions"
  ON public.cross_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_cross_sessions_updated_at
  BEFORE UPDATE ON public.cross_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
