CREATE TABLE public.software_integration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  provider text NOT NULL,
  display_name text NOT NULL,
  integration_type text NOT NULL DEFAULT 'api' CHECK (integration_type IN ('api','oauth','webhook','mcp','internal')),
  endpoint text,
  transport text NOT NULL DEFAULT 'https' CHECK (transport IN ('https','mcp_http','mcp_sse','internal')),
  auth_type text NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none','api_key','bearer','basic','oauth2')),
  credential_ref text CHECK (credential_ref IS NULL OR credential_ref ~ '^[A-Z][A-Z0-9_]{2,64}$'),
  scopes text[] NOT NULL DEFAULT '{}',
  contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','revoked')),
  health text NOT NULL DEFAULT 'unconfigured' CHECK (health IN ('unconfigured','connected','degraded','failed','disconnected')),
  health_detail text,
  last_checked_at timestamptz,
  version text,
  compatibility text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX software_integration_owner_idx ON public.software_integration (owner_user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_integration TO authenticated;
GRANT ALL ON public.software_integration TO service_role;
ALTER TABLE public.software_integration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage their integrations" ON public.software_integration
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE TABLE public.software_integration_grant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  integration_id uuid NOT NULL REFERENCES public.software_integration(id) ON DELETE CASCADE,
  artifact_id uuid NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  installation_id uuid REFERENCES public.software_installation(id) ON DELETE SET NULL,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  granted_tools text[] NOT NULL DEFAULT '{}',
  rationale text,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','revoked')),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, artifact_id)
);

CREATE INDEX software_integration_grant_artifact_idx ON public.software_integration_grant (artifact_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_integration_grant TO authenticated;
GRANT ALL ON public.software_integration_grant TO service_role;
ALTER TABLE public.software_integration_grant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage their integration grants" ON public.software_integration_grant
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE TABLE public.software_integration_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  integration_id uuid REFERENCES public.software_integration(id) ON DELETE CASCADE,
  artifact_id uuid REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  grant_id uuid REFERENCES public.software_integration_grant(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  operation text,
  outcome text NOT NULL DEFAULT 'ok' CHECK (outcome IN ('ok','denied','failed','unavailable')),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX software_integration_event_owner_idx ON public.software_integration_event (owner_user_id, created_at DESC);

GRANT SELECT, INSERT ON public.software_integration_event TO authenticated;
GRANT ALL ON public.software_integration_event TO service_role;
ALTER TABLE public.software_integration_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read their integration events" ON public.software_integration_event
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "owners record their integration events" ON public.software_integration_event
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

CREATE TRIGGER software_integration_touch BEFORE UPDATE ON public.software_integration
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER software_integration_grant_touch BEFORE UPDATE ON public.software_integration_grant
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();