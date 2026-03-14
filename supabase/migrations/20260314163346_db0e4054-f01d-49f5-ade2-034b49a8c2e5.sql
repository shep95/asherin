
-- E-Book sessions table
CREATE TABLE public.ebook_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Book',
  subtitle TEXT DEFAULT '',
  author TEXT DEFAULT '',
  description TEXT DEFAULT '',
  dedication TEXT DEFAULT '',
  copyright TEXT DEFAULT '',
  about_author TEXT DEFAULT '',
  settings JSONB NOT NULL DEFAULT '{}',
  chapters JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- E-Book text uploads (incremental raw text chunks)
CREATE TABLE public.ebook_text_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ebook_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL DEFAULT 'pasted_text',
  content TEXT NOT NULL DEFAULT '',
  word_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ebook_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebook_text_uploads ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own data
CREATE POLICY "Users manage own ebook sessions"
  ON public.ebook_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own ebook text uploads"
  ON public.ebook_text_uploads FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at
CREATE TRIGGER update_ebook_sessions_updated_at
  BEFORE UPDATE ON public.ebook_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
