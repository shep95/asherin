-- ============================================================
-- Phase 1: software artifact foundation
-- ============================================================

CREATE TABLE public.software_artifact (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'untitled artifact',
  slug TEXT,
  description TEXT,
  icon TEXT,
  artifact_type TEXT NOT NULL DEFAULT 'application'
    CHECK (artifact_type IN ('application','component','workflow','pattern_package','integration_package','mcp_connector','other')),
  lifecycle_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft','building','running','testing','failed','repairing','validated','installed','update_available','validating_update','disabled','archived','published')),
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','shared','unlisted','public')),
  current_version_id UUID,
  runtime_session_id UUID,
  runtime_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  compatibility_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  permission_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  integration_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  dependency_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  distribution_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (owner_user_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_artifact TO authenticated;
GRANT ALL ON public.software_artifact TO service_role;
ALTER TABLE public.software_artifact ENABLE ROW LEVEL SECURITY;
CREATE INDEX software_artifact_owner_idx ON public.software_artifact (owner_user_id, updated_at DESC);

CREATE TABLE public.software_artifact_member (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','admin','collaborator','viewer')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_artifact_member TO authenticated;
GRANT ALL ON public.software_artifact_member TO service_role;
ALTER TABLE public.software_artifact_member ENABLE ROW LEVEL SECURITY;
CREATE INDEX software_artifact_member_user_idx ON public.software_artifact_member (user_id);

-- role resolver: definer so member/owner lookup never recurses through RLS
CREATE OR REPLACE FUNCTION public.software_artifact_role(_artifact UUID, _user UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.software_artifact a WHERE a.id = _artifact AND a.owner_user_id = _user) THEN 'owner'
    ELSE (SELECT m.role FROM public.software_artifact_member m WHERE m.artifact_id = _artifact AND m.user_id = _user)
  END
$$;
REVOKE EXECUTE ON FUNCTION public.software_artifact_role(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.software_artifact_role(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.software_can_write(_artifact UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.software_artifact_role(_artifact, _user) IN ('owner','admin')
$$;
REVOKE EXECUTE ON FUNCTION public.software_can_write(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.software_can_write(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.software_can_contribute(_artifact UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.software_artifact_role(_artifact, _user) IN ('owner','admin','collaborator')
$$;
REVOKE EXECUTE ON FUNCTION public.software_can_contribute(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.software_can_contribute(UUID, UUID) TO authenticated, service_role;

CREATE POLICY "read artifacts you own or are a member of" ON public.software_artifact
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.software_artifact_role(id, auth.uid()) IS NOT NULL);
CREATE POLICY "create artifacts you own" ON public.software_artifact
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "update artifacts you administer" ON public.software_artifact
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.software_can_write(id, auth.uid()))
  WITH CHECK (owner_user_id = auth.uid() OR public.software_can_write(id, auth.uid()));
CREATE POLICY "delete artifacts you own" ON public.software_artifact
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

CREATE POLICY "read members of artifacts you can see" ON public.software_artifact_member
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.software_artifact_role(artifact_id, auth.uid()) IS NOT NULL);
CREATE POLICY "owners manage members" ON public.software_artifact_member
  FOR ALL TO authenticated
  USING (public.software_can_write(artifact_id, auth.uid()))
  WITH CHECK (public.software_can_write(artifact_id, auth.uid()));

CREATE TABLE public.software_artifact_version (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  created_by UUID NOT NULL,
  ordinal INTEGER NOT NULL,
  display_version TEXT NOT NULL DEFAULT '0.1.0',
  parent_version_id UUID REFERENCES public.software_artifact_version(id) ON DELETE SET NULL,
  source_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT,
  validation_status TEXT NOT NULL DEFAULT 'unvalidated'
    CHECK (validation_status IN ('unvalidated','validating','validated','failed','quarantined')),
  release_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (release_status IN ('draft','checkpoint','released','rolled_back','superseded')),
  rollback_eligible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, ordinal)
);
GRANT SELECT, INSERT, UPDATE ON public.software_artifact_version TO authenticated;
GRANT ALL ON public.software_artifact_version TO service_role;
ALTER TABLE public.software_artifact_version ENABLE ROW LEVEL SECURITY;
CREATE INDEX software_artifact_version_artifact_idx ON public.software_artifact_version (artifact_id, ordinal DESC);

CREATE POLICY "read versions of artifacts you can see" ON public.software_artifact_version
  FOR SELECT TO authenticated
  USING (public.software_artifact_role(artifact_id, auth.uid()) IS NOT NULL);
CREATE POLICY "contributors append versions" ON public.software_artifact_version
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.software_can_contribute(artifact_id, auth.uid()));
CREATE POLICY "administrators update version status" ON public.software_artifact_version
  FOR UPDATE TO authenticated
  USING (public.software_can_write(artifact_id, auth.uid()))
  WITH CHECK (public.software_can_write(artifact_id, auth.uid()));

CREATE TABLE public.software_navigation_item (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  artifact_id UUID REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'installed' CHECK (source IN ('user','installed')),
  display_name TEXT NOT NULL,
  icon TEXT,
  route TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared','unlisted','public')),
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_navigation_item TO authenticated;
GRANT ALL ON public.software_navigation_item TO service_role;
ALTER TABLE public.software_navigation_item ENABLE ROW LEVEL SECURITY;
CREATE INDEX software_navigation_item_owner_idx ON public.software_navigation_item (owner_user_id, position);
CREATE POLICY "own navigation items" ON public.software_navigation_item
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE TABLE public.software_installation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  artifact_id UUID NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  artifact_version_id UUID REFERENCES public.software_artifact_version(id) ON DELETE SET NULL,
  navigation_item_id UUID REFERENCES public.software_navigation_item(id) ON DELETE SET NULL,
  installed_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  permission_grants JSONB NOT NULL DEFAULT '{}'::jsonb,
  update_state TEXT NOT NULL DEFAULT 'current'
    CHECK (update_state IN ('current','update_available','validating_update','failed','rolled_back')),
  installed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, artifact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_installation TO authenticated;
GRANT ALL ON public.software_installation TO service_role;
ALTER TABLE public.software_installation ENABLE ROW LEVEL SECURITY;
CREATE INDEX software_installation_user_idx ON public.software_installation (user_id, installed_at DESC);
CREATE POLICY "own installations" ON public.software_installation
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.software_artifact_event (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.software_artifact_version(id) ON DELETE SET NULL,
  actor_user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'ok' CHECK (result IN ('ok','failed','pending','unavailable')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.software_artifact_event TO authenticated;
GRANT ALL ON public.software_artifact_event TO service_role;
ALTER TABLE public.software_artifact_event ENABLE ROW LEVEL SECURITY;
CREATE INDEX software_artifact_event_artifact_idx ON public.software_artifact_event (artifact_id, created_at DESC);
CREATE POLICY "read events of artifacts you can see" ON public.software_artifact_event
  FOR SELECT TO authenticated
  USING (public.software_artifact_role(artifact_id, auth.uid()) IS NOT NULL);
CREATE POLICY "contributors append events" ON public.software_artifact_event
  FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() AND public.software_artifact_role(artifact_id, auth.uid()) IS NOT NULL);

-- ownership is taken from the authenticated session, never from the client
CREATE OR REPLACE FUNCTION public.software_force_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'software_artifact' THEN
    NEW.owner_user_id := auth.uid();
  ELSIF TG_TABLE_NAME = 'software_navigation_item' THEN
    NEW.owner_user_id := auth.uid();
  ELSIF TG_TABLE_NAME = 'software_installation' THEN
    NEW.user_id := auth.uid();
  ELSIF TG_TABLE_NAME = 'software_artifact_version' THEN
    NEW.created_by := auth.uid();
    NEW.owner_user_id := COALESCE((SELECT a.owner_user_id FROM public.software_artifact a WHERE a.id = NEW.artifact_id), auth.uid());
  ELSIF TG_TABLE_NAME = 'software_artifact_event' THEN
    NEW.actor_user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER software_artifact_owner BEFORE INSERT ON public.software_artifact
  FOR EACH ROW EXECUTE FUNCTION public.software_force_owner();
CREATE TRIGGER software_navigation_item_owner BEFORE INSERT ON public.software_navigation_item
  FOR EACH ROW EXECUTE FUNCTION public.software_force_owner();
CREATE TRIGGER software_installation_owner BEFORE INSERT ON public.software_installation
  FOR EACH ROW EXECUTE FUNCTION public.software_force_owner();
CREATE TRIGGER software_artifact_version_owner BEFORE INSERT ON public.software_artifact_version
  FOR EACH ROW EXECUTE FUNCTION public.software_force_owner();
CREATE TRIGGER software_artifact_event_owner BEFORE INSERT ON public.software_artifact_event
  FOR EACH ROW EXECUTE FUNCTION public.software_force_owner();

-- identity is immutable: renames never move the artifact
CREATE OR REPLACE FUNCTION public.software_artifact_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed TEXT[];
BEGIN
  NEW.id := OLD.id;
  NEW.owner_user_id := OLD.owner_user_id;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();

  IF NEW.lifecycle_status <> OLD.lifecycle_status THEN
    allowed := CASE OLD.lifecycle_status
      WHEN 'draft' THEN ARRAY['building','archived','disabled','draft']
      WHEN 'building' THEN ARRAY['running','testing','failed','validated','draft','archived']
      WHEN 'running' THEN ARRAY['testing','failed','validated','disabled','archived','building']
      WHEN 'testing' THEN ARRAY['validated','failed','repairing','running','archived']
      WHEN 'failed' THEN ARRAY['repairing','building','draft','archived','disabled']
      WHEN 'repairing' THEN ARRAY['building','testing','failed','validated','archived']
      WHEN 'validated' THEN ARRAY['installed','published','building','testing','archived','disabled','draft']
      WHEN 'installed' THEN ARRAY['update_available','disabled','archived','validated','published']
      WHEN 'update_available' THEN ARRAY['validating_update','installed','disabled','archived']
      WHEN 'validating_update' THEN ARRAY['installed','failed','update_available','archived']
      WHEN 'published' THEN ARRAY['validated','installed','disabled','archived','update_available']
      WHEN 'disabled' THEN ARRAY['draft','validated','installed','archived']
      WHEN 'archived' THEN ARRAY['draft','disabled']
      ELSE ARRAY[]::TEXT[]
    END;
    IF NOT (NEW.lifecycle_status = ANY (allowed)) THEN
      RAISE EXCEPTION 'illegal artifact lifecycle transition: % -> %', OLD.lifecycle_status, NEW.lifecycle_status;
    END IF;
  END IF;

  IF NEW.visibility = 'published' THEN
    NEW.visibility := OLD.visibility;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER software_artifact_guard_update BEFORE UPDATE ON public.software_artifact
  FOR EACH ROW EXECUTE FUNCTION public.software_artifact_guard();

-- versions are immutable lineage: only status fields may move
CREATE OR REPLACE FUNCTION public.software_version_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.artifact_id := OLD.artifact_id;
  NEW.owner_user_id := OLD.owner_user_id;
  NEW.created_by := OLD.created_by;
  NEW.ordinal := OLD.ordinal;
  NEW.display_version := OLD.display_version;
  NEW.parent_version_id := OLD.parent_version_id;
  NEW.source_ref := OLD.source_ref;
  NEW.state_ref := OLD.state_ref;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER software_version_guard_update BEFORE UPDATE ON public.software_artifact_version
  FOR EACH ROW EXECUTE FUNCTION public.software_version_guard();

CREATE OR REPLACE FUNCTION public.software_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER software_navigation_item_touch BEFORE UPDATE ON public.software_navigation_item
  FOR EACH ROW EXECUTE FUNCTION public.software_touch_updated_at();
CREATE TRIGGER software_installation_touch BEFORE UPDATE ON public.software_installation
  FOR EACH ROW EXECUTE FUNCTION public.software_touch_updated_at();