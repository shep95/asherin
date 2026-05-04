-- Asher AI chat sessions (conversation list) + messages with file attachments
CREATE TABLE IF NOT EXISTS public.asher_ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.asher_ai_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asher_ai_sessions_owner_all"
ON public.asher_ai_sessions FOR ALL
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_asher_ai_sessions_user_updated
  ON public.asher_ai_sessions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.asher_ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.asher_ai_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.asher_ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asher_ai_messages_owner_all"
ON public.asher_ai_messages FOR ALL
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_asher_ai_messages_session_created
  ON public.asher_ai_messages(session_id, created_at ASC);

CREATE TRIGGER asher_ai_sessions_touch
BEFORE UPDATE ON public.asher_ai_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for ASHER AI user attachments (images, videos, PDFs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('asher-ai-uploads', 'asher-ai-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "asher_ai_uploads_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'asher-ai-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "asher_ai_uploads_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'asher-ai-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "asher_ai_uploads_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'asher-ai-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);