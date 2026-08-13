-- HISTORY REDACTION: operator mailboxes that once appeared in this file have been
-- replaced with role labels. These statements already ran; identity is now decided
-- by public.is_internal_staff/is_internal_operator (sha256 digests). Do not
-- re-add an address here — a committed mailbox is a disclosure.
DO $$ BEGIN CREATE TYPE public.hoa_channel_kind AS ENUM ('text','voice','vault','broadcast'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.hoa_server_role AS ENUM ('owner','operator','analyst','guest','houseofasher'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.hoa_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  country text,
  description text,
  is_mothership boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS hoa_servers_one_mothership ON public.hoa_servers ((true)) WHERE is_mothership;
CREATE INDEX IF NOT EXISTS hoa_servers_country_idx ON public.hoa_servers (country);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hoa_servers TO authenticated;
GRANT ALL ON public.hoa_servers TO service_role;

CREATE TABLE IF NOT EXISTS public.hoa_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.hoa_servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL,
  rank_label text NOT NULL DEFAULT 'Operator',
  role public.hoa_server_role NOT NULL DEFAULT 'operator',
  clearance_rank smallint NOT NULL DEFAULT 1 CHECK (clearance_rank BETWEEN 0 AND 4),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, user_id)
);
CREATE INDEX IF NOT EXISTS hoa_members_user_idx ON public.hoa_members (user_id);
CREATE INDEX IF NOT EXISTS hoa_members_server_idx ON public.hoa_members (server_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hoa_members TO authenticated;
GRANT ALL ON public.hoa_members TO service_role;

CREATE OR REPLACE FUNCTION public.hoa_is_member(_server uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hoa_members WHERE server_id=_server AND user_id=_user);
$$;
CREATE OR REPLACE FUNCTION public.hoa_member_clearance(_server uuid, _user uuid)
RETURNS smallint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT clearance_rank FROM public.hoa_members WHERE server_id=_server AND user_id=_user), -1);
$$;
CREATE OR REPLACE FUNCTION public.hoa_member_role(_server uuid, _user uuid)
RETURNS public.hoa_server_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.hoa_members WHERE server_id=_server AND user_id=_user;
$$;
CREATE OR REPLACE FUNCTION public.hoa_is_houseofasher(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user(_user)
      OR EXISTS (SELECT 1 FROM public.hoa_members m JOIN public.hoa_servers s ON s.id=m.server_id
                  WHERE m.user_id=_user AND s.is_mothership AND m.role='houseofasher');
$$;
REVOKE ALL ON FUNCTION public.hoa_is_member(uuid,uuid), public.hoa_member_clearance(uuid,uuid), public.hoa_member_role(uuid,uuid), public.hoa_is_houseofasher(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hoa_is_member(uuid,uuid), public.hoa_member_clearance(uuid,uuid), public.hoa_member_role(uuid,uuid), public.hoa_is_houseofasher(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.hoa_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.hoa_servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind public.hoa_channel_kind NOT NULL DEFAULT 'text',
  min_clearance smallint NOT NULL DEFAULT 0 CHECK (min_clearance BETWEEN 0 AND 4),
  topic text,
  compartments text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, name)
);
CREATE INDEX IF NOT EXISTS hoa_channels_server_idx ON public.hoa_channels (server_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hoa_channels TO authenticated;
GRANT ALL ON public.hoa_channels TO service_role;

CREATE TABLE IF NOT EXISTS public.hoa_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.hoa_servers(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.hoa_channels(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  author_handle text NOT NULL,
  body text NOT NULL,
  compartments text[] NOT NULL DEFAULT '{}',
  sealed boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hoa_messages_channel_time ON public.hoa_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hoa_messages_server_time ON public.hoa_messages (server_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hoa_messages TO authenticated;
GRANT ALL ON public.hoa_messages TO service_role;

CREATE TABLE IF NOT EXISTS public.hoa_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.hoa_servers(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role_grant public.hoa_server_role NOT NULL DEFAULT 'operator',
  clearance_grant smallint NOT NULL DEFAULT 1 CHECK (clearance_grant BETWEEN 0 AND 4),
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  uses integer NOT NULL DEFAULT 0,
  mirror_mothership boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hoa_invites_server_idx ON public.hoa_invites (server_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hoa_invites TO authenticated;
GRANT ALL ON public.hoa_invites TO service_role;

CREATE TABLE IF NOT EXISTS public.hoa_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES public.hoa_servers(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_handle text,
  action text NOT NULL,
  target text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hoa_audit_server_time ON public.hoa_audit (server_id, created_at DESC);
GRANT SELECT, INSERT ON public.hoa_audit TO authenticated;
GRANT ALL ON public.hoa_audit TO service_role;

CREATE TABLE IF NOT EXISTS public.hoa_aureon_training_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.hoa_messages(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.hoa_servers(id) ON DELETE CASCADE,
  server_code text NOT NULL,
  channel_name text NOT NULL,
  channel_kind public.hoa_channel_kind NOT NULL,
  author_id uuid,
  author_handle text,
  body text NOT NULL,
  compartments text[] NOT NULL DEFAULT '{}',
  sealed boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS hoa_aureon_feed_time ON public.hoa_aureon_training_feed (ingested_at DESC);
CREATE INDEX IF NOT EXISTS hoa_aureon_feed_open ON public.hoa_aureon_training_feed (ingested_at) WHERE consumed_at IS NULL;
GRANT SELECT, UPDATE ON public.hoa_aureon_training_feed TO service_role;
REVOKE ALL ON public.hoa_aureon_training_feed FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.hoa_fanout_to_aureon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_server public.hoa_servers%ROWTYPE; v_channel public.hoa_channels%ROWTYPE;
BEGIN
  SELECT * INTO v_server FROM public.hoa_servers WHERE id=NEW.server_id;
  SELECT * INTO v_channel FROM public.hoa_channels WHERE id=NEW.channel_id;
  INSERT INTO public.hoa_aureon_training_feed
    (message_id, server_id, server_code, channel_name, channel_kind,
     author_id, author_handle, body, compartments, sealed, meta)
  VALUES (NEW.id, NEW.server_id, v_server.code, v_channel.name, v_channel.kind,
    NEW.author_id, NEW.author_handle,
    CASE WHEN NEW.sealed THEN '' ELSE NEW.body END,
    NEW.compartments, NEW.sealed,
    jsonb_build_object('country', v_server.country, 'is_mothership', v_server.is_mothership,
                       'min_clearance', v_channel.min_clearance, 'pinned', NEW.pinned));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hoa_messages_fanout ON public.hoa_messages;
CREATE TRIGGER hoa_messages_fanout AFTER INSERT ON public.hoa_messages
  FOR EACH ROW EXECUTE FUNCTION public.hoa_fanout_to_aureon();

ALTER TABLE public.hoa_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoa_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoa_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoa_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoa_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoa_aureon_training_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "servers_members_read" ON public.hoa_servers FOR SELECT TO authenticated
  USING (public.hoa_is_member(id, auth.uid()) OR public.hoa_is_houseofasher(auth.uid()));
CREATE POLICY "servers_authenticated_create" ON public.hoa_servers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND is_mothership = false);

CREATE POLICY "members_co_server_read" ON public.hoa_members FOR SELECT TO authenticated
  USING (public.hoa_is_member(server_id, auth.uid()) OR public.hoa_is_houseofasher(auth.uid()));
CREATE POLICY "members_self_insert" ON public.hoa_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "members_leave_self" ON public.hoa_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "channels_cleared_read" ON public.hoa_channels FOR SELECT TO authenticated
  USING (public.hoa_is_houseofasher(auth.uid())
    OR (public.hoa_is_member(server_id, auth.uid())
        AND public.hoa_member_clearance(server_id, auth.uid()) >= min_clearance));
CREATE POLICY "channels_owners_write" ON public.hoa_channels FOR INSERT TO authenticated
  WITH CHECK (public.hoa_member_role(server_id, auth.uid()) IN ('owner','operator'));

CREATE POLICY "messages_cleared_read" ON public.hoa_messages FOR SELECT TO authenticated
  USING (public.hoa_is_houseofasher(auth.uid())
    OR EXISTS (SELECT 1 FROM public.hoa_channels c WHERE c.id=channel_id
      AND public.hoa_is_member(c.server_id, auth.uid())
      AND public.hoa_member_clearance(c.server_id, auth.uid()) >= c.min_clearance));
CREATE POLICY "messages_cleared_insert" ON public.hoa_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.hoa_channels c WHERE c.id=channel_id
      AND c.server_id = hoa_messages.server_id
      AND public.hoa_is_member(c.server_id, auth.uid())
      AND public.hoa_member_clearance(c.server_id, auth.uid()) >= c.min_clearance));

CREATE POLICY "invites_owners_read" ON public.hoa_invites FOR SELECT TO authenticated
  USING (public.hoa_member_role(server_id, auth.uid()) IN ('owner','operator'));
CREATE POLICY "invites_owners_create" ON public.hoa_invites FOR INSERT TO authenticated
  WITH CHECK (public.hoa_member_role(server_id, auth.uid()) IN ('owner','operator') AND created_by = auth.uid());
CREATE POLICY "invites_owners_delete" ON public.hoa_invites FOR DELETE TO authenticated
  USING (public.hoa_member_role(server_id, auth.uid()) IN ('owner','operator'));

CREATE POLICY "audit_members_read" ON public.hoa_audit FOR SELECT TO authenticated
  USING (public.hoa_is_member(server_id, auth.uid()) OR public.hoa_is_houseofasher(auth.uid()));
CREATE POLICY "audit_self_append" ON public.hoa_audit FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

ALTER TABLE public.hoa_messages REPLICA IDENTITY FULL;
ALTER TABLE public.hoa_audit REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='hoa_messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.hoa_messages'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='hoa_audit') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.hoa_audit'; END IF;
END $$;

INSERT INTO public.hoa_servers (code, name, country, description, is_mothership)
VALUES ('HOA', '#houseofasher', NULL,
  'The Asherin mothership. Every country server mirrors here so the sovereign brain retains full global signal.', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.hoa_channels (server_id, name, kind, min_clearance, topic)
SELECT s.id, v.name, v.kind::public.hoa_channel_kind, v.min_clearance, v.topic
  FROM public.hoa_servers s,
       (VALUES
         ('global-briefings', 'text', 1, '0600Z rollup across every sovereign server.'),
         ('country-liaison',  'text', 2, 'Inter-country coordination between sovereigns.'),
         ('aureon-stream',    'text', 3, 'Live stream of Aureon-relevant signals from every country.'),
         ('mothership-vault', 'vault', 4, 'Sovereign vault — only #houseofasher operators may unseal.'),
         ('all-sovereign',    'broadcast', 0, 'Pushes across every country server on activation.')
       ) AS v(name, kind, min_clearance, topic)
  WHERE s.code = 'HOA'
    AND NOT EXISTS (SELECT 1 FROM public.hoa_channels c WHERE c.server_id = s.id AND c.name = v.name);

INSERT INTO public.hoa_members (server_id, user_id, handle, rank_label, role, clearance_rank)
SELECT s.id, u.id, COALESCE(split_part(u.email,'@',1),'sovereign'), 'Sovereign', 'houseofasher', 4
  FROM public.hoa_servers s
  JOIN auth.users u ON lower(u.email) IN ('operator-owner@redacted.invalid','operator-two@redacted.invalid')
 WHERE s.code = 'HOA'
ON CONFLICT (server_id, user_id) DO UPDATE SET role='houseofasher', clearance_rank=4;