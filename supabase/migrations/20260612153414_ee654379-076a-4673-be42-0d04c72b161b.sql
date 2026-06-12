-- ============================================================
-- DELETION OVERHAUL — Phase 1 (corrected)
-- ============================================================

-- ---------- 1. ORPHAN CLEANUP ----------
DELETE FROM public.asher_code_files          WHERE project_id      NOT IN (SELECT id FROM public.asher_code_projects);
DELETE FROM public.asher_code_branches       WHERE project_id      NOT IN (SELECT id FROM public.asher_code_projects);
DELETE FROM public.asher_code_chat_messages  WHERE project_id      NOT IN (SELECT id FROM public.asher_code_projects);
DELETE FROM public.asher_code_embeddings     WHERE project_id      NOT IN (SELECT id FROM public.asher_code_projects);
DELETE FROM public.asher_ai_messages         WHERE session_id      NOT IN (SELECT id FROM public.asher_ai_sessions);
DELETE FROM public.scrapper_files            WHERE session_id      NOT IN (SELECT id FROM public.scrapper_sessions);
DELETE FROM public.community_replies         WHERE post_id         NOT IN (SELECT id FROM public.community_posts);
DELETE FROM public.community_votes           WHERE post_id         NOT IN (SELECT id FROM public.community_posts);
DELETE FROM public.ebook_text_uploads        WHERE session_id      NOT IN (SELECT id FROM public.ebook_sessions);
DELETE FROM public.messages                  WHERE conversation_id NOT IN (SELECT id FROM public.conversations);
DELETE FROM public.vibe_video_messages       WHERE project_id      NOT IN (SELECT id FROM public.vibe_video_projects);
DELETE FROM public.vibe_video_versions       WHERE project_id      NOT IN (SELECT id FROM public.vibe_video_projects);
DELETE FROM public.zali_research             WHERE project_id      NOT IN (SELECT id FROM public.zali_projects);
DELETE FROM public.zerlal_scans              WHERE project_id      NOT IN (SELECT id FROM public.zerlal_projects);
DELETE FROM public.zerlal_findings           WHERE project_id      NOT IN (SELECT id FROM public.zerlal_projects);
DELETE FROM public.zerlal_findings           WHERE scan_id IS NOT NULL AND scan_id NOT IN (SELECT id FROM public.zerlal_scans);
DELETE FROM public.zerlal_sbom_components    WHERE project_id      NOT IN (SELECT id FROM public.zerlal_projects);
DELETE FROM public.notebook_cells            WHERE notebook_id     NOT IN (SELECT id FROM public.notebooks);
DELETE FROM public.notebook_comments         WHERE notebook_id     NOT IN (SELECT id FROM public.notebooks);
DELETE FROM public.notebook_shares           WHERE notebook_id     NOT IN (SELECT id FROM public.notebooks);
DELETE FROM public.notebook_versions         WHERE notebook_id     NOT IN (SELECT id FROM public.notebooks);
DELETE FROM public.asha_documents            WHERE session_id      NOT IN (SELECT id FROM public.asha_sessions);
DELETE FROM public.aziion_trades             WHERE session_id      NOT IN (SELECT id FROM public.aziion_sessions);
DELETE FROM public.asher_messages            WHERE conversation_id NOT IN (SELECT id FROM public.asher_conversations);
DELETE FROM public.asher_conversation_members WHERE conversation_id NOT IN (SELECT id FROM public.asher_conversations);
DELETE FROM public.team_members              WHERE team_id         NOT IN (SELECT id FROM public.teams);
DELETE FROM public.team_invites              WHERE team_id         NOT IN (SELECT id FROM public.teams);

-- ---------- 2. CASCADE FOREIGN KEYS (idempotent) ----------
DO $$
DECLARE
  pairs text[][] := ARRAY[
    ['asher_code_files',          'project_id',      'asher_code_projects'],
    ['asher_code_branches',       'project_id',      'asher_code_projects'],
    ['asher_code_chat_messages',  'project_id',      'asher_code_projects'],
    ['asher_code_embeddings',     'project_id',      'asher_code_projects'],
    ['asher_ai_messages',         'session_id',      'asher_ai_sessions'],
    ['scrapper_files',            'session_id',      'scrapper_sessions'],
    ['community_replies',         'post_id',         'community_posts'],
    ['community_votes',           'post_id',         'community_posts'],
    ['ebook_text_uploads',        'session_id',      'ebook_sessions'],
    ['messages',                  'conversation_id', 'conversations'],
    ['vibe_video_messages',       'project_id',      'vibe_video_projects'],
    ['vibe_video_versions',       'project_id',      'vibe_video_projects'],
    ['zali_research',             'project_id',      'zali_projects'],
    ['zerlal_scans',              'project_id',      'zerlal_projects'],
    ['zerlal_findings',           'project_id',      'zerlal_projects'],
    ['zerlal_findings',           'scan_id',         'zerlal_scans'],
    ['zerlal_sbom_components',    'project_id',      'zerlal_projects'],
    ['notebook_cells',            'notebook_id',     'notebooks'],
    ['notebook_comments',         'notebook_id',     'notebooks'],
    ['notebook_shares',           'notebook_id',     'notebooks'],
    ['notebook_versions',         'notebook_id',     'notebooks'],
    ['asha_documents',            'session_id',      'asha_sessions'],
    ['aziion_trades',             'session_id',      'aziion_sessions'],
    ['asher_messages',            'conversation_id', 'asher_conversations'],
    ['asher_conversation_members','conversation_id', 'asher_conversations'],
    ['team_members',              'team_id',         'teams'],
    ['team_invites',              'team_id',         'teams']
  ];
  i int; child text; col text; parent text; con text;
BEGIN
  FOR i IN 1 .. array_length(pairs, 1) LOOP
    child  := pairs[i][1]; col := pairs[i][2]; parent := pairs[i][3];
    con    := child || '_' || col || '_fkey_cascade';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = con AND conrelid = format('public.%I', child)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE CASCADE',
        child, con, col, parent
      );
    END IF;
  END LOOP;
END $$;

-- code_snippets.folder_id → SET NULL (loose snippets allowed)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'code_snippets_folder_id_fkey_setnull'
      AND conrelid = 'public.code_snippets'::regclass
  ) THEN
    UPDATE public.code_snippets SET folder_id = NULL
    WHERE folder_id IS NOT NULL AND folder_id NOT IN (SELECT id FROM public.code_folders);
    ALTER TABLE public.code_snippets
      ADD CONSTRAINT code_snippets_folder_id_fkey_setnull
      FOREIGN KEY (folder_id) REFERENCES public.code_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------- 3. SOFT-DELETE COLUMNS ----------
ALTER TABLE public.conversations         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.asher_brains          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.axrlen_sessions       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.asher_ai_sessions     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.ide_sessions          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.asher_code_projects   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.briefing_reports      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.asher_saved_targets   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.zerlal_projects       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.scrapper_sessions     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS conversations_active_idx        ON public.conversations(user_id)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS asher_brains_active_idx         ON public.asher_brains(uploaded_by)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS axrlen_sessions_active_idx      ON public.axrlen_sessions(user_id)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS asher_ai_sessions_active_idx    ON public.asher_ai_sessions(user_id)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ide_sessions_active_idx         ON public.ide_sessions(user_id)          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS asher_code_projects_active_idx  ON public.asher_code_projects(owner_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS briefing_reports_active_idx     ON public.briefing_reports(user_id)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS asher_saved_targets_active_idx  ON public.asher_saved_targets(user_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS zerlal_projects_active_idx      ON public.zerlal_projects(user_id)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS scrapper_sessions_active_idx    ON public.scrapper_sessions(user_id)     WHERE deleted_at IS NULL;

-- ---------- 4. TRANSACTIONAL DELETE RPCs ----------
CREATE OR REPLACE FUNCTION public.delete_conversation(p_conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = p_conv_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Conversation not found or not authorized';
  END IF;
  DELETE FROM public.conversations WHERE id = p_conv_id AND user_id = _uid;
END $$;
REVOKE ALL ON FUNCTION public.delete_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_conversation(uuid) TO authenticated;

-- Soft-delete RPC: maps each allowed table to its owner column.
CREATE OR REPLACE FUNCTION public.soft_delete_row(p_table text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner_col text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _owner_col := CASE p_table
    WHEN 'conversations'         THEN 'user_id'
    WHEN 'asher_brains'          THEN 'uploaded_by'
    WHEN 'axrlen_sessions'       THEN 'user_id'
    WHEN 'asher_ai_sessions'     THEN 'user_id'
    WHEN 'ide_sessions'          THEN 'user_id'
    WHEN 'asher_code_projects'   THEN 'owner_id'
    WHEN 'briefing_reports'      THEN 'user_id'
    WHEN 'asher_saved_targets'   THEN 'user_id'
    WHEN 'zerlal_projects'       THEN 'user_id'
    WHEN 'scrapper_sessions'     THEN 'user_id'
    ELSE NULL
  END;
  IF _owner_col IS NULL THEN RAISE EXCEPTION 'Table % not soft-deletable', p_table; END IF;
  EXECUTE format(
    'UPDATE public.%I SET deleted_at = now() WHERE id = $1 AND %I = $2 AND deleted_at IS NULL',
    p_table, _owner_col
  ) USING p_id, _uid;
END $$;
REVOKE ALL ON FUNCTION public.soft_delete_row(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_row(text, uuid) TO authenticated;

-- Restore RPC
CREATE OR REPLACE FUNCTION public.restore_soft_deleted(p_table text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner_col text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _owner_col := CASE p_table
    WHEN 'conversations'         THEN 'user_id'
    WHEN 'asher_brains'          THEN 'uploaded_by'
    WHEN 'axrlen_sessions'       THEN 'user_id'
    WHEN 'asher_ai_sessions'     THEN 'user_id'
    WHEN 'ide_sessions'          THEN 'user_id'
    WHEN 'asher_code_projects'   THEN 'owner_id'
    WHEN 'briefing_reports'      THEN 'user_id'
    WHEN 'asher_saved_targets'   THEN 'user_id'
    WHEN 'zerlal_projects'       THEN 'user_id'
    WHEN 'scrapper_sessions'     THEN 'user_id'
    ELSE NULL
  END;
  IF _owner_col IS NULL THEN RAISE EXCEPTION 'Table % not soft-deletable', p_table; END IF;
  EXECUTE format(
    'UPDATE public.%I SET deleted_at = NULL WHERE id = $1 AND %I = $2',
    p_table, _owner_col
  ) USING p_id, _uid;
END $$;
REVOKE ALL ON FUNCTION public.restore_soft_deleted(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_soft_deleted(text, uuid) TO authenticated;

-- ---------- 5. HARD-DELETE PURGE ----------
CREATE OR REPLACE FUNCTION public.purge_soft_deleted(p_retention_days int DEFAULT 30)
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
    'zerlal_projects','scrapper_sessions'
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
REVOKE ALL ON FUNCTION public.purge_soft_deleted(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted(int) TO service_role;