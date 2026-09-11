-- ============================================================
-- Phase 6: sharing, collaboration, export, forks, updates
-- ============================================================

-- 1. wider capability-based roles on membership
ALTER TABLE public.software_artifact_member DROP CONSTRAINT IF EXISTS software_artifact_member_role_check;
ALTER TABLE public.software_artifact_member
  ADD CONSTRAINT software_artifact_member_role_check
  CHECK (role IN ('owner','admin','editor','commenter','viewer','installer','collaborator'));

CREATE OR REPLACE FUNCTION public.software_can_contribute(_artifact UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.software_artifact_role(_artifact, _user) IN ('owner','admin','editor','collaborator')
$$;

-- 2. fork lineage on the artifact. identity is never copied, only remembered.
ALTER TABLE public.software_artifact
  ADD COLUMN IF NOT EXISTS parent_artifact_id UUID REFERENCES public.software_artifact(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_version_id UUID REFERENCES public.software_artifact_version(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS fork_source TEXT;

CREATE INDEX IF NOT EXISTS software_artifact_parent_idx ON public.software_artifact (parent_artifact_id);

-- public artifacts are readable by signed-in people; private ones are not
DROP POLICY IF EXISTS "read artifacts you own or are a member of" ON public.software_artifact;
CREATE POLICY "read artifacts you own, are a member of, or that are public"
  ON public.software_artifact
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR public.software_artifact_role(id, auth.uid()) IS NOT NULL
    OR visibility = 'public'
  );

-- 3. invitations
CREATE TABLE IF NOT EXISTS public.software_artifact_invitation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_user_id UUID,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin','editor','commenter','viewer','installer')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','revoked','expired')),
  delivery TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery IN ('pending','sent','unavailable')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_artifact_invitation TO authenticated;
GRANT ALL ON public.software_artifact_invitation TO service_role;
ALTER TABLE public.software_artifact_invitation ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS software_invitation_pending_idx
  ON public.software_artifact_invitation (artifact_id, invitee_email)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS software_invitation_email_idx ON public.software_artifact_invitation (invitee_email);

CREATE POLICY "read invitations you sent or received" ON public.software_artifact_invitation
  FOR SELECT TO authenticated
  USING (
    public.software_can_write(artifact_id, auth.uid())
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = invitee_email
  );
CREATE POLICY "administrators create invitations" ON public.software_artifact_invitation
  FOR INSERT TO authenticated
  WITH CHECK (inviter_user_id = auth.uid() AND public.software_can_write(artifact_id, auth.uid()));
CREATE POLICY "administrators update invitations" ON public.software_artifact_invitation
  FOR UPDATE TO authenticated
  USING (public.software_can_write(artifact_id, auth.uid()))
  WITH CHECK (public.software_can_write(artifact_id, auth.uid()));
CREATE POLICY "administrators delete invitations" ON public.software_artifact_invitation
  FOR DELETE TO authenticated
  USING (public.software_can_write(artifact_id, auth.uid()));

-- 4. share links: a private artifact is never reachable by guessing its id
CREATE TABLE IF NOT EXISTS public.software_share_link (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','commenter','installer')),
  revoked BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_share_link TO authenticated;
GRANT ALL ON public.software_share_link TO service_role;
ALTER TABLE public.software_share_link ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS software_share_link_artifact_idx ON public.software_share_link (artifact_id);
CREATE POLICY "administrators manage share links" ON public.software_share_link
  FOR ALL TO authenticated
  USING (public.software_can_write(artifact_id, auth.uid()))
  WITH CHECK (created_by = auth.uid() AND public.software_can_write(artifact_id, auth.uid()));

-- 5. export records: every download is remembered with its scan verdict
CREATE TABLE IF NOT EXISTS public.software_artifact_export (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.software_artifact_version(id) ON DELETE SET NULL,
  actor_user_id UUID NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','blocked','unavailable')),
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  scan JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.software_artifact_export TO authenticated;
GRANT ALL ON public.software_artifact_export TO service_role;
ALTER TABLE public.software_artifact_export ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS software_export_artifact_idx ON public.software_artifact_export (artifact_id, created_at DESC);
CREATE POLICY "read exports of artifacts you can see" ON public.software_artifact_export
  FOR SELECT TO authenticated
  USING (public.software_artifact_role(artifact_id, auth.uid()) IS NOT NULL);
CREATE POLICY "record your own exports" ON public.software_artifact_export
  FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() AND public.software_artifact_role(artifact_id, auth.uid()) IS NOT NULL);

-- 6. acceptance paths. membership is written by the server, never by the client.
CREATE OR REPLACE FUNCTION public.software_accept_invitation(_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.software_artifact_invitation;
  caller_email TEXT := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in to accept this invitation';
  END IF;
  SELECT * INTO inv FROM public.software_artifact_invitation WHERE token = _token;
  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'this invitation is not valid';
  END IF;
  IF inv.status <> 'pending' THEN
    RAISE EXCEPTION 'this invitation is no longer pending';
  END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.software_artifact_invitation SET status = 'expired', updated_at = now() WHERE id = inv.id;
    RAISE EXCEPTION 'this invitation has expired';
  END IF;
  IF caller_email = '' OR caller_email <> inv.invitee_email THEN
    RAISE EXCEPTION 'this invitation was issued to a different account';
  END IF;

  INSERT INTO public.software_artifact_member (artifact_id, user_id, role)
  VALUES (inv.artifact_id, auth.uid(), inv.role)
  ON CONFLICT (artifact_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.software_artifact_invitation
    SET status = 'accepted', accepted_at = now(), updated_at = now(), invitee_user_id = auth.uid()
    WHERE id = inv.id;

  INSERT INTO public.software_artifact_event (artifact_id, actor_user_id, event_type, result, metadata)
  VALUES (inv.artifact_id, auth.uid(), 'artifact.shared', 'ok', jsonb_build_object('action','invitation_accepted','role', inv.role));

  RETURN inv.artifact_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.software_accept_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.software_accept_invitation(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.software_redeem_share_link(_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link public.software_share_link;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in to open this link';
  END IF;
  SELECT * INTO link FROM public.software_share_link WHERE token = _token;
  IF link.id IS NULL OR link.revoked OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RAISE EXCEPTION 'this link is no longer active';
  END IF;

  INSERT INTO public.software_artifact_member (artifact_id, user_id, role)
  VALUES (link.artifact_id, auth.uid(), link.role)
  ON CONFLICT (artifact_id, user_id) DO NOTHING;

  INSERT INTO public.software_artifact_event (artifact_id, actor_user_id, event_type, result, metadata)
  VALUES (link.artifact_id, auth.uid(), 'artifact.shared', 'ok', jsonb_build_object('action','share_link_redeemed','role', link.role));

  RETURN link.artifact_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.software_redeem_share_link(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.software_redeem_share_link(TEXT) TO authenticated, service_role;

CREATE TRIGGER software_invitation_touch
  BEFORE UPDATE ON public.software_artifact_invitation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER software_share_link_touch
  BEFORE UPDATE ON public.software_share_link
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();