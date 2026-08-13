-- HISTORY REDACTION: operator mailboxes that once appeared in this file have been
-- replaced with role labels. These statements already ran; identity is now decided
-- by public.is_internal_staff/is_internal_operator (sha256 digests). Do not
-- re-add an address here — a committed mailbox is a disclosure.

DO $$ BEGIN
  CREATE TYPE public.ziaassets_rank AS ENUM (
    'emperor', 'hand', 'admin', 'officer', 'researcher', 'worker', 'initiate'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ziaassets_member_status AS ENUM ('active','suspended','revoked','pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ziaassets_channel_kind AS ENUM ('chamber','direct','broadcast','vault-thread');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ziaassets_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  codename text NOT NULL UNIQUE,
  full_name text,
  rank public.ziaassets_rank NOT NULL DEFAULT 'initiate',
  status public.ziaassets_member_status NOT NULL DEFAULT 'pending',
  phrase_hash text,
  key_salt text,
  duress_hash text,
  mfa_enrolled boolean NOT NULL DEFAULT false,
  totp_secret text,
  locked_until timestamptz,
  failed_attempts int NOT NULL DEFAULT 0,
  last_seen_at timestamptz,
  invited_by uuid REFERENCES auth.users(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ziaassets_members TO authenticated;
GRANT ALL ON public.ziaassets_members TO service_role;
ALTER TABLE public.ziaassets_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ziaassets_is_emperor(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _uid AND lower(u.email) = 'operator-owner@redacted.invalid'
  );
$$;

CREATE OR REPLACE FUNCTION public.ziaassets_has_min_rank(_uid uuid, _min public.ziaassets_rank)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.ziaassets_is_emperor(_uid) OR EXISTS (
    SELECT 1 FROM public.ziaassets_members m
    WHERE m.user_id = _uid
      AND m.status = 'active'
      AND (
        CASE m.rank
          WHEN 'emperor' THEN 7 WHEN 'hand' THEN 6 WHEN 'admin' THEN 5
          WHEN 'officer' THEN 4 WHEN 'researcher' THEN 3 WHEN 'worker' THEN 2
          ELSE 1 END
      ) >= (
        CASE _min
          WHEN 'emperor' THEN 7 WHEN 'hand' THEN 6 WHEN 'admin' THEN 5
          WHEN 'officer' THEN 4 WHEN 'researcher' THEN 3 WHEN 'worker' THEN 2
          ELSE 1 END
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.ziaassets_is_active_member(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.ziaassets_is_emperor(_uid) OR EXISTS (
    SELECT 1 FROM public.ziaassets_members m
    WHERE m.user_id = _uid AND m.status = 'active'
  );
$$;

CREATE POLICY "za_members_read" ON public.ziaassets_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.ziaassets_is_active_member(auth.uid()));
CREATE POLICY "za_members_insert_self" ON public.ziaassets_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "za_members_update" ON public.ziaassets_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.ziaassets_is_emperor(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.ziaassets_is_emperor(auth.uid()));
CREATE POLICY "za_members_delete_emperor" ON public.ziaassets_members FOR DELETE TO authenticated
  USING (public.ziaassets_is_emperor(auth.uid()));

CREATE TABLE IF NOT EXISTS public.ziaassets_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  codename text,
  rank public.ziaassets_rank NOT NULL DEFAULT 'initiate',
  token text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ziaassets_invitations TO authenticated;
GRANT ALL ON public.ziaassets_invitations TO service_role;
ALTER TABLE public.ziaassets_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "za_invites_manage" ON public.ziaassets_invitations FOR ALL TO authenticated
  USING (public.ziaassets_is_emperor(auth.uid()) OR invited_by = auth.uid())
  WITH CHECK (public.ziaassets_is_emperor(auth.uid()) OR invited_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.ziaassets_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  kind public.ziaassets_channel_kind NOT NULL DEFAULT 'chamber',
  topic text,
  min_rank public.ziaassets_rank NOT NULL DEFAULT 'initiate',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ziaassets_channels TO authenticated;
GRANT ALL ON public.ziaassets_channels TO service_role;
ALTER TABLE public.ziaassets_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "za_channels_read" ON public.ziaassets_channels FOR SELECT TO authenticated
  USING (public.ziaassets_has_min_rank(auth.uid(), min_rank));
CREATE POLICY "za_channels_insert" ON public.ziaassets_channels FOR INSERT TO authenticated
  WITH CHECK (public.ziaassets_has_min_rank(auth.uid(), 'admin'::public.ziaassets_rank));
CREATE POLICY "za_channels_update" ON public.ziaassets_channels FOR UPDATE TO authenticated
  USING (public.ziaassets_is_emperor(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "za_channels_delete" ON public.ziaassets_channels FOR DELETE TO authenticated
  USING (public.ziaassets_is_emperor(auth.uid()));

CREATE TABLE IF NOT EXISTS public.ziaassets_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.ziaassets_channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'text',
  ciphertext text NOT NULL,
  iv text NOT NULL,
  aad text,
  reply_to uuid REFERENCES public.ziaassets_messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ziaassets_messages_channel_created_idx
  ON public.ziaassets_messages(channel_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ziaassets_messages TO authenticated;
GRANT ALL ON public.ziaassets_messages TO service_role;
ALTER TABLE public.ziaassets_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "za_messages_read" ON public.ziaassets_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ziaassets_channels c
                 WHERE c.id = channel_id AND public.ziaassets_has_min_rank(auth.uid(), c.min_rank)));
CREATE POLICY "za_messages_insert" ON public.ziaassets_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.ziaassets_channels c
    WHERE c.id = channel_id AND public.ziaassets_has_min_rank(auth.uid(), c.min_rank)));
CREATE POLICY "za_messages_update" ON public.ziaassets_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.ziaassets_is_emperor(auth.uid()));
CREATE POLICY "za_messages_delete" ON public.ziaassets_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.ziaassets_is_emperor(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.ziaassets_messages;
ALTER TABLE public.ziaassets_messages REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS public.ziaassets_vault_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.ziaassets_vault_folders(id) ON DELETE CASCADE,
  min_rank public.ziaassets_rank NOT NULL DEFAULT 'researcher',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ziaassets_vault_folders TO authenticated;
GRANT ALL ON public.ziaassets_vault_folders TO service_role;
ALTER TABLE public.ziaassets_vault_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "za_folders_read" ON public.ziaassets_vault_folders FOR SELECT TO authenticated
  USING (public.ziaassets_has_min_rank(auth.uid(), min_rank));
CREATE POLICY "za_folders_insert" ON public.ziaassets_vault_folders FOR INSERT TO authenticated
  WITH CHECK (public.ziaassets_has_min_rank(auth.uid(), 'admin'::public.ziaassets_rank));
CREATE POLICY "za_folders_update" ON public.ziaassets_vault_folders FOR UPDATE TO authenticated
  USING (public.ziaassets_is_emperor(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "za_folders_delete" ON public.ziaassets_vault_folders FOR DELETE TO authenticated
  USING (public.ziaassets_is_emperor(auth.uid()));

CREATE TABLE IF NOT EXISTS public.ziaassets_vault_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES public.ziaassets_vault_folders(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  filename_ct text NOT NULL,
  filename_iv text NOT NULL,
  display_name text,
  mime text,
  size_bytes bigint,
  iv text NOT NULL,
  sha256 text,
  min_rank public.ziaassets_rank NOT NULL DEFAULT 'researcher',
  tags text[] DEFAULT '{}',
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ziaassets_vault_files TO authenticated;
GRANT ALL ON public.ziaassets_vault_files TO service_role;
ALTER TABLE public.ziaassets_vault_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "za_files_read" ON public.ziaassets_vault_files FOR SELECT TO authenticated
  USING (public.ziaassets_has_min_rank(auth.uid(), min_rank));
CREATE POLICY "za_files_insert" ON public.ziaassets_vault_files FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.ziaassets_has_min_rank(auth.uid(), 'researcher'::public.ziaassets_rank));
CREATE POLICY "za_files_update" ON public.ziaassets_vault_files FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.ziaassets_is_emperor(auth.uid()));
CREATE POLICY "za_files_delete" ON public.ziaassets_vault_files FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.ziaassets_is_emperor(auth.uid()));

CREATE TABLE IF NOT EXISTS public.ziaassets_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ziaassets_audit_actor_idx ON public.ziaassets_audit(actor_id, created_at DESC);
GRANT SELECT, INSERT ON public.ziaassets_audit TO authenticated;
GRANT ALL ON public.ziaassets_audit TO service_role;
ALTER TABLE public.ziaassets_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "za_audit_insert" ON public.ziaassets_audit FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
CREATE POLICY "za_audit_read" ON public.ziaassets_audit FOR SELECT TO authenticated
  USING (public.ziaassets_has_min_rank(auth.uid(), 'admin'::public.ziaassets_rank));

CREATE TABLE IF NOT EXISTS public.ziaassets_gate_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ip text,
  success boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ziaassets_gate_attempts TO authenticated;
GRANT ALL ON public.ziaassets_gate_attempts TO service_role;
ALTER TABLE public.ziaassets_gate_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "za_gate_insert" ON public.ziaassets_gate_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "za_gate_read" ON public.ziaassets_gate_attempts FOR SELECT TO authenticated
  USING (public.ziaassets_is_emperor(auth.uid()));

CREATE TRIGGER ziaassets_members_touch BEFORE UPDATE ON public.ziaassets_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER ziaassets_channels_touch BEFORE UPDATE ON public.ziaassets_channels
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER ziaassets_vault_folders_touch BEFORE UPDATE ON public.ziaassets_vault_folders
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER ziaassets_vault_files_touch BEFORE UPDATE ON public.ziaassets_vault_files
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.ziaassets_set_phrase(_phrase text, _key_salt text, _duress_phrase text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(_phrase) < 16 THEN RAISE EXCEPTION 'Passphrase must be at least 16 characters'; END IF;
  IF length(_key_salt) < 16 THEN RAISE EXCEPTION 'Key salt required'; END IF;
  UPDATE public.ziaassets_members
     SET phrase_hash = crypt(_phrase, gen_salt('bf', 12)),
         key_salt = _key_salt,
         duress_hash = CASE WHEN _duress_phrase IS NOT NULL AND length(_duress_phrase) >= 12
                            THEN crypt(_duress_phrase, gen_salt('bf', 12))
                            ELSE duress_hash END,
         failed_attempts = 0,
         locked_until = NULL,
         updated_at = now()
   WHERE user_id = _uid;
  INSERT INTO public.ziaassets_audit(actor_id, action, target_type, target_id, metadata)
    VALUES (_uid, 'phrase_set', 'member', _uid, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.ziaassets_verify_phrase(_phrase text)
RETURNS TABLE(ok boolean, key_salt text, member_rank public.ziaassets_rank, duress boolean, locked_until timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _m public.ziaassets_members%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _m FROM public.ziaassets_members WHERE user_id = _uid;
  IF NOT FOUND OR _m.phrase_hash IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::public.ziaassets_rank, false, NULL::timestamptz;
    RETURN;
  END IF;
  IF _m.locked_until IS NOT NULL AND _m.locked_until > now() THEN
    RETURN QUERY SELECT false, NULL::text, _m.rank, false, _m.locked_until;
    RETURN;
  END IF;
  IF _m.duress_hash IS NOT NULL AND _m.duress_hash = crypt(_phrase, _m.duress_hash) THEN
    INSERT INTO public.ziaassets_audit(actor_id, action, target_type, target_id, metadata)
      VALUES (_uid, 'duress_triggered', 'member', _uid, '{}'::jsonb);
    UPDATE public.ziaassets_members SET status = 'suspended' WHERE user_id = _uid;
    RETURN QUERY SELECT false, NULL::text, _m.rank, true, NULL::timestamptz;
    RETURN;
  END IF;
  IF _m.phrase_hash = crypt(_phrase, _m.phrase_hash) THEN
    UPDATE public.ziaassets_members SET failed_attempts = 0, locked_until = NULL, last_seen_at = now()
     WHERE user_id = _uid;
    INSERT INTO public.ziaassets_gate_attempts(user_id, success) VALUES (_uid, true);
    RETURN QUERY SELECT true, _m.key_salt, _m.rank, false, NULL::timestamptz;
    RETURN;
  ELSE
    UPDATE public.ziaassets_members
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
     WHERE user_id = _uid;
    INSERT INTO public.ziaassets_gate_attempts(user_id, success, reason) VALUES (_uid, false, 'bad_phrase');
    RETURN QUERY SELECT false, NULL::text, _m.rank, false,
      (SELECT locked_until FROM public.ziaassets_members WHERE user_id = _uid);
    RETURN;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ziaassets_bootstrap_emperor()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _mid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.ziaassets_is_emperor(_uid) THEN RAISE EXCEPTION 'Not emperor'; END IF;
  SELECT id INTO _mid FROM public.ziaassets_members WHERE user_id = _uid;
  IF _mid IS NULL THEN
    INSERT INTO public.ziaassets_members(user_id, codename, full_name, rank, status)
      VALUES (_uid, 'EMPEROR', 'Asher Newton', 'emperor', 'active')
      RETURNING id INTO _mid;
    INSERT INTO public.ziaassets_channels(name, slug, kind, topic, min_rank, created_by)
      VALUES
        ('Throne Room', 'throne-room', 'chamber', 'Emperor + Hand of the Emperor', 'hand', _uid),
        ('War Room',    'war-room',    'chamber', 'Admins and above', 'admin', _uid),
        ('Research Hall','research-hall','chamber','Researchers and above', 'researcher', _uid),
        ('Workshop',    'workshop',    'chamber', 'All active workers', 'worker', _uid),
        ('Announcements','announcements','broadcast','Emperor announcements', 'initiate', _uid)
      ON CONFLICT (slug) DO NOTHING;
  ELSE
    UPDATE public.ziaassets_members SET rank='emperor', status='active' WHERE id = _mid AND (rank <> 'emperor' OR status <> 'active');
  END IF;
  RETURN _mid;
END $$;

GRANT EXECUTE ON FUNCTION public.ziaassets_set_phrase(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ziaassets_verify_phrase(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ziaassets_bootstrap_emperor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ziaassets_is_emperor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ziaassets_is_active_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ziaassets_has_min_rank(uuid, public.ziaassets_rank) TO authenticated;
