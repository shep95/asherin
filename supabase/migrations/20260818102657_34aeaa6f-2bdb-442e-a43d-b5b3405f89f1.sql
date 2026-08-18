ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS legacy_asher_session_id uuid;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS legacy_asher_message_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_legacy_asher_session_id_key
  ON public.conversations (legacy_asher_session_id) WHERE legacy_asher_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS messages_legacy_asher_message_id_key
  ON public.messages (legacy_asher_message_id) WHERE legacy_asher_message_id IS NOT NULL;

INSERT INTO public.conversations (user_id, title, mode, created_at, updated_at, legacy_asher_session_id)
SELECT s.user_id, s.title, 'chat', s.created_at, s.updated_at, s.id
FROM public.asher_ai_sessions s
WHERE s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.legacy_asher_session_id = s.id
  );

INSERT INTO public.messages (conversation_id, user_id, role, content, attachments, created_at, legacy_asher_message_id)
SELECT c.id, m.user_id, m.role, m.content, m.attachments, m.created_at, m.id
FROM public.asher_ai_messages m
JOIN public.conversations c ON c.legacy_asher_session_id = m.session_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.messages x WHERE x.legacy_asher_message_id = m.id
);