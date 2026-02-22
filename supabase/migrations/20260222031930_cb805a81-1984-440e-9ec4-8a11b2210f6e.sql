
-- IDE Sessions table for persistent sessions
CREATE TABLE public.ide_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  open_file_ids TEXT[] NOT NULL DEFAULT '{}',
  active_file_id TEXT,
  panel_config JSONB NOT NULL DEFAULT '{"leftOpen": true, "rightOpen": true, "bottomOpen": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ide_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own IDE sessions"
ON public.ide_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own IDE sessions"
ON public.ide_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own IDE sessions"
ON public.ide_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own IDE sessions"
ON public.ide_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_ide_sessions_updated_at
BEFORE UPDATE ON public.ide_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
