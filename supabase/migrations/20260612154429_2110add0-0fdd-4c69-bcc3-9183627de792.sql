
-- Phase 3: Soft-delete for encrypted messages
ALTER TABLE public.asher_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS asher_messages_active_idx ON public.asher_messages(conversation_id) WHERE deleted_at IS NULL;

-- RPC: soft-delete a message (sender or super-owner only)
CREATE OR REPLACE FUNCTION public.soft_delete_asher_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _sender uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT sender_id INTO _sender FROM public.asher_messages WHERE id = p_message_id;
  IF _sender IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF _sender <> _uid AND NOT public.is_asher_super_owner(_uid) THEN
    RAISE EXCEPTION 'Only the sender can delete this message';
  END IF;
  UPDATE public.asher_messages SET deleted_at = now() WHERE id = p_message_id AND deleted_at IS NULL;
END $$;

-- Extend purge to include asher_messages
CREATE OR REPLACE FUNCTION public.purge_soft_deleted(p_retention_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb := '{}'::jsonb;
  _count bigint;
  _tables text[] := ARRAY[
    'conversations','asher_brains','axrlen_sessions','asher_ai_sessions',
    'ide_sessions','asher_code_projects','briefing_reports','asher_saved_targets',
    'zerlal_projects','scrapper_sessions','asher_messages'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY _tables LOOP
    EXECUTE format(
      'WITH d AS (DELETE FROM public.%I WHERE deleted_at IS NOT NULL AND deleted_at < now() - ($1 || '' days'')::interval RETURNING 1) SELECT COUNT(*) FROM d',
      t
    ) INTO _count USING p_retention_days;
    _result := _result || jsonb_build_object(t, _count);
  END LOOP;
  RETURN _result;
END $$;
