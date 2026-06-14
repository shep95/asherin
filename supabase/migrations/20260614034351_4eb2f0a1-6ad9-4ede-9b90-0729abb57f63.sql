BEGIN;

DROP POLICY IF EXISTS "Authenticated users can view threat intel" ON public.threat_intelligence;
CREATE POLICY "threat_intel_admin_only_select"
  ON public.threat_intelligence FOR SELECT TO authenticated
  USING (is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.asher_is_channel_admin(_user_id uuid, _channel_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.asher_channels c
    WHERE c.id = _channel_id
      AND (
        is_asher_super_owner(_user_id)
        OR (c.org_id IS NOT NULL AND asher_is_org_admin(_user_id, c.org_id))
        OR (c.department_id IS NOT NULL AND asher_is_dept_admin(_user_id, c.department_id))
        OR (c.section_id IS NOT NULL AND asher_is_section_officer(_user_id, c.section_id))
      )
  );
$$;

DROP POLICY IF EXISTS "asher_chan_mem_select" ON public.asher_channel_members;
CREATE POLICY "asher_chan_mem_select"
  ON public.asher_channel_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR asher_is_channel_admin(auth.uid(), channel_id));

DROP POLICY IF EXISTS "asher_chan_mem_write" ON public.asher_channel_members;
CREATE POLICY "asher_chan_mem_write"
  ON public.asher_channel_members FOR ALL TO authenticated
  USING  (asher_is_channel_admin(auth.uid(), channel_id))
  WITH CHECK (asher_is_channel_admin(auth.uid(), channel_id));

CREATE OR REPLACE FUNCTION public.asher_is_channel_member(_user_id uuid, _channel_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.asher_channel_members
    WHERE channel_id = _channel_id AND user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "asher_chan_select" ON public.asher_channels;
CREATE POLICY "asher_chan_select"
  ON public.asher_channels FOR SELECT TO authenticated
  USING (
    asher_is_channel_member(auth.uid(), id)
    OR is_asher_super_owner(auth.uid())
    OR (org_id IS NOT NULL AND asher_is_org_admin(auth.uid(), org_id))
  );

DROP POLICY IF EXISTS "Operator updates own status" ON public.asher_operators;
CREATE POLICY "Operator updates own status"
  ON public.asher_operators FOR UPDATE TO public
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.heartbeat_intel_slot(_job_id uuid)
  RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.intel_job_queue SET heartbeat_at = now()
   WHERE id = _job_id AND status = 'running' AND user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.release_intel_slot(_job_id uuid, _success boolean DEFAULT true)
  RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.intel_job_queue
     SET status = CASE WHEN _success THEN 'done' ELSE 'failed' END, finished_at = now()
   WHERE id = _job_id AND user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.try_acquire_intel_slot(_job_id uuid, _job_type text, _max_concurrent integer DEFAULT 2)
  RETURNS TABLE(acquired boolean, queue_pos integer, running_count integer)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _running INT; _waiting_ahead INT; _my_created TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.intel_job_queue WHERE id = _job_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: job % does not belong to caller', _job_id;
  END IF;
  UPDATE public.intel_job_queue SET status='failed', finished_at=now()
   WHERE job_type=_job_type AND status='running' AND heartbeat_at < now() - interval '45 seconds';
  UPDATE public.intel_job_queue SET status='failed', finished_at=now()
   WHERE job_type=_job_type AND status='waiting' AND created_at < now() - interval '8 minutes';
  SELECT COUNT(*) INTO _running FROM public.intel_job_queue WHERE job_type=_job_type AND status='running';
  IF _running < _max_concurrent THEN
    UPDATE public.intel_job_queue SET status='running', started_at=now(), heartbeat_at=now(), queue_position=0
     WHERE id=_job_id AND status='waiting';
    RETURN QUERY SELECT TRUE, 0, _running + 1;
  ELSE
    SELECT created_at INTO _my_created FROM public.intel_job_queue WHERE id=_job_id;
    SELECT COUNT(*) INTO _waiting_ahead FROM public.intel_job_queue
     WHERE job_type=_job_type AND status='waiting' AND id<>_job_id
       AND (created_at < _my_created OR (created_at = _my_created AND id < _job_id));
    UPDATE public.intel_job_queue SET queue_position=_waiting_ahead+1 WHERE id=_job_id;
    RETURN QUERY SELECT FALSE, _waiting_ahead + 1, _running;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO public
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own GitHub connections" ON public.github_connections;
DROP POLICY IF EXISTS "Users can view their own GitHub connections" ON public.github_connections;
DROP POLICY IF EXISTS "Users can create their own GitHub connections" ON public.github_connections;
DROP POLICY IF EXISTS "Users can delete their own GitHub connections" ON public.github_connections;
CREATE POLICY "github_select" ON public.github_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "github_insert" ON public.github_connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "github_update" ON public.github_connections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "github_delete" ON public.github_connections FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own google accounts" ON public.google_accounts;
DROP POLICY IF EXISTS "Users can view their own google accounts" ON public.google_accounts;
DROP POLICY IF EXISTS "Users can insert their own google accounts" ON public.google_accounts;
DROP POLICY IF EXISTS "Users can delete their own google accounts" ON public.google_accounts;
CREATE POLICY "google_select" ON public.google_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "google_insert" ON public.google_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_update" ON public.google_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_delete" ON public.google_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.user_sessions;
CREATE POLICY "Users can update own sessions" ON public.user_sessions FOR UPDATE TO public
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public keys readable by operators" ON public.asher_identity_keys;
DROP POLICY IF EXISTS "User manages own key" ON public.asher_identity_keys;
CREATE POLICY "identity_keys_operators_read" ON public.asher_identity_keys FOR SELECT TO authenticated
  USING (is_asher_operator(auth.uid()) OR is_admin_user(auth.uid()));
CREATE POLICY "identity_keys_self_all" ON public.asher_identity_keys FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Recipient reads own key" ON public.asher_message_keys;
DROP POLICY IF EXISTS "Sender writes message keys" ON public.asher_message_keys;
CREATE POLICY "message_keys_recipient_read" ON public.asher_message_keys FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);
CREATE POLICY "message_keys_sender_insert" ON public.asher_message_keys FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.asher_messages m
    JOIN public.asher_conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE m.id = asher_message_keys.message_id
      AND cm.user_id = auth.uid()
  ));

CREATE POLICY "gate_attempts_service_role_all" ON public.asher_gate_attempts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own alerts" ON public.asha_alerts;
CREATE POLICY "Users can update own alerts" ON public.asha_alerts FOR UPDATE TO public
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own entity matches" ON public.asha_entity_matches;
CREATE POLICY "Users can update own entity matches" ON public.asha_entity_matches FOR UPDATE TO public
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own monitor rules" ON public.asha_monitor_rules;
CREATE POLICY "Users can update own monitor rules" ON public.asha_monitor_rules FOR UPDATE TO public
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners update conversations" ON public.asher_conversations;
CREATE POLICY "Owners update conversations" ON public.asher_conversations FOR UPDATE TO public
  USING ((created_by = auth.uid()) OR is_admin_user(auth.uid()))
  WITH CHECK ((created_by = auth.uid()) OR is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Sender edits own messages" ON public.asher_messages;
CREATE POLICY "Sender edits own messages" ON public.asher_messages FOR UPDATE TO public
  USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

COMMIT;