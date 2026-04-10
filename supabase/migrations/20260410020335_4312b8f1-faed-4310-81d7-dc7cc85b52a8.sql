
-- Scrapper sessions table
CREATE TABLE public.scrapper_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Session',
  status TEXT NOT NULL DEFAULT 'active',
  total_files INTEGER NOT NULL DEFAULT 0,
  total_text_length INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scrapper_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.scrapper_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sessions" ON public.scrapper_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.scrapper_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.scrapper_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_scrapper_sessions_updated_at
  BEFORE UPDATE ON public.scrapper_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Scrapper files table
CREATE TABLE public.scrapper_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.scrapper_sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT 'unknown',
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scrapper_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own files" ON public.scrapper_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own files" ON public.scrapper_files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own files" ON public.scrapper_files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own files" ON public.scrapper_files FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_scrapper_files_updated_at
  BEFORE UPDATE ON public.scrapper_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for scrapper uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('scrapper-uploads', 'scrapper-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload scrapper files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'scrapper-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own scrapper files" ON storage.objects FOR SELECT USING (bucket_id = 'scrapper-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own scrapper files" ON storage.objects FOR DELETE USING (bucket_id = 'scrapper-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
