
CREATE TABLE public.asher_code_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.asher_code_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asher_code_chat_messages_project ON public.asher_code_chat_messages(project_id, created_at);

ALTER TABLE public.asher_code_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their IDE chat" ON public.asher_code_chat_messages
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Owners insert their IDE chat" ON public.asher_code_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners delete their IDE chat" ON public.asher_code_chat_messages
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);
