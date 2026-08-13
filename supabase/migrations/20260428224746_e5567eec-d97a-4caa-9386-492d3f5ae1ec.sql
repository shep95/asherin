-- HISTORY REDACTION: operator mailboxes that once appeared in this file have been
-- replaced with role labels. These statements already ran; identity is now decided
-- by public.is_internal_staff/is_internal_operator (sha256 digests). Do not
-- re-add an address here — a committed mailbox is a disclosure.
DO $$ BEGIN CREATE TYPE public.asher_role AS ENUM ('super_owner','primary_admin','secondary_admin','dept_admin','officer','analyst');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.asher_classification AS ENUM ('UNCLASSIFIED','CUI','CONFIDENTIAL','SECRET','TOP_SECRET','TS_SCI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.asher_invite_status AS ENUM ('pending','accepted','revoked','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.asher_channel_kind AS ENUM ('org','department','section','team','shared');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.asher_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, code TEXT, org_type TEXT, country TEXT,
  max_classification public.asher_classification NOT NULL DEFAULT 'SECRET',
  data_residency TEXT,
  plan TEXT NOT NULL DEFAULT 'enterprise',
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.asher_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.asher_orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL, code TEXT, description TEXT,
  default_classification public.asher_classification NOT NULL DEFAULT 'SECRET',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asher_dept_org ON public.asher_departments(org_id);

CREATE TABLE IF NOT EXISTS public.asher_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.asher_departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asher_sec_dept ON public.asher_sections(department_id);

CREATE TABLE IF NOT EXISTS public.asher_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.asher_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL, focus TEXT,
  lead_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asher_team_sec ON public.asher_teams(section_id);

CREATE TABLE IF NOT EXISTS public.asher_org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.asher_orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.asher_role NOT NULL,
  department_id UUID REFERENCES public.asher_departments(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.asher_sections(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.asher_teams(id) ON DELETE CASCADE,
  clearance public.asher_classification,
  rank TEXT, position TEXT, full_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asher_mem_user ON public.asher_org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_asher_mem_org ON public.asher_org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_asher_mem_dept ON public.asher_org_memberships(department_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_asher_mem_org      ON public.asher_org_memberships(org_id, user_id, role) WHERE department_id IS NULL AND section_id IS NULL AND team_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_asher_mem_dept     ON public.asher_org_memberships(org_id, user_id, role, department_id) WHERE department_id IS NOT NULL AND section_id IS NULL AND team_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_asher_mem_section  ON public.asher_org_memberships(org_id, user_id, role, section_id) WHERE section_id IS NOT NULL AND team_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_asher_mem_team     ON public.asher_org_memberships(org_id, user_id, role, team_id) WHERE team_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.asher_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  org_id UUID NOT NULL REFERENCES public.asher_orgs(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.asher_departments(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.asher_sections(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.asher_teams(id) ON DELETE CASCADE,
  role public.asher_role NOT NULL,
  email TEXT NOT NULL, full_name TEXT, rank TEXT, position TEXT,
  clearance public.asher_classification, message TEXT,
  status public.asher_invite_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_asher_inv_org ON public.asher_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_asher_inv_email ON public.asher_invitations(lower(email));

CREATE TABLE IF NOT EXISTS public.asher_org_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.asher_orgs(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role public.asher_role,
  action TEXT NOT NULL,
  target_type TEXT, target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asher_org_audit_org ON public.asher_org_audit_log(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.asher_org_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_a UUID NOT NULL REFERENCES public.asher_orgs(id) ON DELETE CASCADE,
  org_b UUID NOT NULL REFERENCES public.asher_orgs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_a, org_b)
);

CREATE TABLE IF NOT EXISTS public.asher_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.asher_channel_kind NOT NULL,
  org_id UUID REFERENCES public.asher_orgs(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.asher_departments(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.asher_sections(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.asher_teams(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  classification public.asher_classification NOT NULL DEFAULT 'SECRET',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asher_channels_org ON public.asher_channels(org_id);

CREATE TABLE IF NOT EXISTS public.asher_channel_members (
  channel_id UUID NOT NULL REFERENCES public.asher_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_post BOOLEAN NOT NULL DEFAULT TRUE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_asher_super_owner(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = _uid AND email = 'operator-owner@redacted.invalid');
$$;

CREATE OR REPLACE FUNCTION public.asher_has_role_in_org(_uid uuid, _org uuid, _roles public.asher_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_asher_super_owner(_uid)
      OR EXISTS (SELECT 1 FROM public.asher_org_memberships
                  WHERE user_id = _uid AND org_id = _org AND role = ANY(_roles) AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.asher_is_org_admin(_uid uuid, _org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.asher_has_role_in_org(_uid, _org, ARRAY['primary_admin','secondary_admin']::public.asher_role[]);
$$;

CREATE OR REPLACE FUNCTION public.asher_is_dept_admin(_uid uuid, _dept uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_asher_super_owner(_uid)
      OR EXISTS (SELECT 1 FROM public.asher_org_memberships m
                   JOIN public.asher_departments d ON d.id = _dept
                  WHERE m.user_id = _uid AND m.org_id = d.org_id AND m.status = 'active'
                    AND ( m.role IN ('primary_admin','secondary_admin')
                       OR (m.role = 'dept_admin' AND m.department_id = _dept) ));
$$;

CREATE OR REPLACE FUNCTION public.asher_is_section_officer(_uid uuid, _section uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_asher_super_owner(_uid)
      OR EXISTS (SELECT 1 FROM public.asher_org_memberships m
                   JOIN public.asher_sections s ON s.id = _section
                   JOIN public.asher_departments d ON d.id = s.department_id
                  WHERE m.user_id = _uid AND m.org_id = d.org_id AND m.status = 'active'
                    AND ( m.role IN ('primary_admin','secondary_admin')
                       OR (m.role = 'dept_admin' AND m.department_id = d.id)
                       OR (m.role = 'officer' AND m.section_id = _section) ));
$$;

CREATE OR REPLACE FUNCTION public.asher_is_org_member(_uid uuid, _org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_asher_super_owner(_uid)
      OR EXISTS (SELECT 1 FROM public.asher_org_memberships
                  WHERE user_id = _uid AND org_id = _org AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS asher_orgs_touch ON public.asher_orgs;
CREATE TRIGGER asher_orgs_touch BEFORE UPDATE ON public.asher_orgs FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS asher_dept_touch ON public.asher_departments;
CREATE TRIGGER asher_dept_touch BEFORE UPDATE ON public.asher_departments FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

ALTER TABLE public.asher_orgs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_departments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_sections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_org_memberships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_invitations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_org_audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_org_connections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_channels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_channel_members   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asher_orgs_select" ON public.asher_orgs FOR SELECT TO authenticated USING (public.asher_is_org_member(auth.uid(), id));
CREATE POLICY "asher_orgs_insert_super" ON public.asher_orgs FOR INSERT TO authenticated WITH CHECK (public.is_asher_super_owner(auth.uid()));
CREATE POLICY "asher_orgs_update" ON public.asher_orgs FOR UPDATE TO authenticated USING (public.is_asher_super_owner(auth.uid()) OR public.asher_is_org_admin(auth.uid(), id));
CREATE POLICY "asher_orgs_delete_super" ON public.asher_orgs FOR DELETE TO authenticated USING (public.is_asher_super_owner(auth.uid()));

CREATE POLICY "asher_dept_select" ON public.asher_departments FOR SELECT TO authenticated USING (public.asher_is_org_member(auth.uid(), org_id));
CREATE POLICY "asher_dept_write" ON public.asher_departments FOR ALL TO authenticated USING (public.asher_is_org_admin(auth.uid(), org_id)) WITH CHECK (public.asher_is_org_admin(auth.uid(), org_id));

CREATE POLICY "asher_sec_select" ON public.asher_sections FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.asher_departments d WHERE d.id = department_id AND public.asher_is_org_member(auth.uid(), d.org_id)));
CREATE POLICY "asher_sec_write" ON public.asher_sections FOR ALL TO authenticated USING (public.asher_is_dept_admin(auth.uid(), department_id)) WITH CHECK (public.asher_is_dept_admin(auth.uid(), department_id));

CREATE POLICY "asher_team_select" ON public.asher_teams FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.asher_sections s JOIN public.asher_departments d ON d.id = s.department_id WHERE s.id = section_id AND public.asher_is_org_member(auth.uid(), d.org_id)));
CREATE POLICY "asher_team_write" ON public.asher_teams FOR ALL TO authenticated USING (public.asher_is_section_officer(auth.uid(), section_id)) WITH CHECK (public.asher_is_section_officer(auth.uid(), section_id));

CREATE POLICY "asher_mem_select" ON public.asher_org_memberships FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR public.asher_is_org_admin(auth.uid(), org_id)
  OR (department_id IS NOT NULL AND public.asher_is_dept_admin(auth.uid(), department_id))
  OR (section_id IS NOT NULL AND public.asher_is_section_officer(auth.uid(), section_id))
);
CREATE POLICY "asher_mem_insert" ON public.asher_org_memberships FOR INSERT TO authenticated WITH CHECK (
  public.is_asher_super_owner(auth.uid())
  OR public.asher_is_org_admin(auth.uid(), org_id)
  OR (department_id IS NOT NULL AND public.asher_is_dept_admin(auth.uid(), department_id))
  OR (section_id IS NOT NULL AND public.asher_is_section_officer(auth.uid(), section_id))
);
CREATE POLICY "asher_mem_update" ON public.asher_org_memberships FOR UPDATE TO authenticated USING (public.is_asher_super_owner(auth.uid()) OR public.asher_is_org_admin(auth.uid(), org_id));
CREATE POLICY "asher_mem_delete" ON public.asher_org_memberships FOR DELETE TO authenticated USING (public.is_asher_super_owner(auth.uid()) OR public.asher_is_org_admin(auth.uid(), org_id));

CREATE POLICY "asher_inv_select" ON public.asher_invitations FOR SELECT TO authenticated USING (
  invited_by = auth.uid() OR accepted_by = auth.uid()
  OR public.asher_is_org_admin(auth.uid(), org_id)
  OR (department_id IS NOT NULL AND public.asher_is_dept_admin(auth.uid(), department_id))
  OR (section_id IS NOT NULL AND public.asher_is_section_officer(auth.uid(), section_id))
  OR public.is_asher_super_owner(auth.uid())
);
CREATE POLICY "asher_inv_insert" ON public.asher_invitations FOR INSERT TO authenticated WITH CHECK (
  invited_by = auth.uid()
  AND ( public.is_asher_super_owner(auth.uid())
     OR public.asher_is_org_admin(auth.uid(), org_id)
     OR (department_id IS NOT NULL AND public.asher_is_dept_admin(auth.uid(), department_id))
     OR (section_id IS NOT NULL AND public.asher_is_section_officer(auth.uid(), section_id)) )
);
CREATE POLICY "asher_inv_update" ON public.asher_invitations FOR UPDATE TO authenticated USING (
  invited_by = auth.uid() OR public.asher_is_org_admin(auth.uid(), org_id) OR public.is_asher_super_owner(auth.uid())
);

CREATE POLICY "asher_org_audit_select" ON public.asher_org_audit_log FOR SELECT TO authenticated USING (
  public.is_asher_super_owner(auth.uid())
  OR (org_id IS NOT NULL AND public.asher_is_org_admin(auth.uid(), org_id))
);
CREATE POLICY "asher_org_audit_insert" ON public.asher_org_audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE POLICY "asher_conn_select" ON public.asher_org_connections FOR SELECT TO authenticated USING (public.asher_is_org_member(auth.uid(), org_a) OR public.asher_is_org_member(auth.uid(), org_b));
CREATE POLICY "asher_conn_write" ON public.asher_org_connections FOR ALL TO authenticated USING (public.asher_is_org_admin(auth.uid(), org_a) OR public.asher_is_org_admin(auth.uid(), org_b) OR public.is_asher_super_owner(auth.uid())) WITH CHECK (public.asher_is_org_admin(auth.uid(), org_a) OR public.asher_is_org_admin(auth.uid(), org_b) OR public.is_asher_super_owner(auth.uid()));

CREATE POLICY "asher_chan_select" ON public.asher_channels FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.asher_channel_members cm WHERE cm.channel_id = id AND cm.user_id = auth.uid())
  OR public.is_asher_super_owner(auth.uid())
  OR (org_id IS NOT NULL AND public.asher_is_org_admin(auth.uid(), org_id))
);
CREATE POLICY "asher_chan_write" ON public.asher_channels FOR ALL TO authenticated USING (
  public.is_asher_super_owner(auth.uid())
  OR (org_id IS NOT NULL AND public.asher_is_org_admin(auth.uid(), org_id))
  OR (department_id IS NOT NULL AND public.asher_is_dept_admin(auth.uid(), department_id))
  OR (section_id IS NOT NULL AND public.asher_is_section_officer(auth.uid(), section_id))
) WITH CHECK (
  public.is_asher_super_owner(auth.uid())
  OR (org_id IS NOT NULL AND public.asher_is_org_admin(auth.uid(), org_id))
  OR (department_id IS NOT NULL AND public.asher_is_dept_admin(auth.uid(), department_id))
  OR (section_id IS NOT NULL AND public.asher_is_section_officer(auth.uid(), section_id))
);

CREATE POLICY "asher_chan_mem_select" ON public.asher_channel_members FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.asher_channels c WHERE c.id = channel_id AND (
       public.is_asher_super_owner(auth.uid())
    OR (c.org_id IS NOT NULL AND public.asher_is_org_admin(auth.uid(), c.org_id))
    OR (c.department_id IS NOT NULL AND public.asher_is_dept_admin(auth.uid(), c.department_id))
    OR (c.section_id IS NOT NULL AND public.asher_is_section_officer(auth.uid(), c.section_id))
  ))
);
CREATE POLICY "asher_chan_mem_write" ON public.asher_channel_members FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.asher_channels c WHERE c.id = channel_id AND (
       public.is_asher_super_owner(auth.uid())
    OR (c.org_id IS NOT NULL AND public.asher_is_org_admin(auth.uid(), c.org_id))
    OR (c.department_id IS NOT NULL AND public.asher_is_dept_admin(auth.uid(), c.department_id))
    OR (c.section_id IS NOT NULL AND public.asher_is_section_officer(auth.uid(), c.section_id))
  ))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.asher_channels c WHERE c.id = channel_id AND (
       public.is_asher_super_owner(auth.uid())
    OR (c.org_id IS NOT NULL AND public.asher_is_org_admin(auth.uid(), c.org_id))
    OR (c.department_id IS NOT NULL AND public.asher_is_dept_admin(auth.uid(), c.department_id))
    OR (c.section_id IS NOT NULL AND public.asher_is_section_officer(auth.uid(), c.section_id))
  ))
);

CREATE OR REPLACE FUNCTION public.asher_accept_invitation(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv public.asher_invitations%ROWTYPE; _uid uuid; _email text;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  SELECT * INTO _inv FROM public.asher_invitations WHERE token = _token AND status = 'pending' AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation invalid or expired'; END IF;
  IF lower(_inv.email) <> lower(_email) THEN RAISE EXCEPTION 'Invitation belongs to a different email'; END IF;
  INSERT INTO public.asher_org_memberships (org_id, user_id, role, department_id, section_id, team_id, clearance, rank, position, full_name, invited_by)
    VALUES (_inv.org_id, _uid, _inv.role, _inv.department_id, _inv.section_id, _inv.team_id, _inv.clearance, _inv.rank, _inv.position, _inv.full_name, _inv.invited_by)
    ON CONFLICT DO NOTHING;
  UPDATE public.asher_invitations SET status = 'accepted', accepted_by = _uid, accepted_at = now() WHERE id = _inv.id;
  INSERT INTO public.asher_org_audit_log (org_id, actor_id, actor_role, action, target_type, target_id, metadata)
    VALUES (_inv.org_id, _uid, _inv.role, 'invitation_accepted', 'invitation', _inv.id, jsonb_build_object('email', _inv.email, 'role', _inv.role));
  RETURN _inv.org_id;
END $$;