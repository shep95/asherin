
-- 1) Server-scoped API key (BYOK). Ciphertext hidden from client via view.
ALTER TABLE public.hoa_servers
  ADD COLUMN IF NOT EXISTS api_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS api_key_provider text,       -- 'openai' | 'anthropic' | 'lovable'
  ADD COLUMN IF NOT EXISTS api_key_hint text,           -- last 4 chars
  ADD COLUMN IF NOT EXISTS api_key_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS api_key_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Force client selects to never see the ciphertext by revoking column-level SELECT.
REVOKE SELECT (api_key_ciphertext) ON public.hoa_servers FROM authenticated;
-- authenticated retains SELECT on other columns via existing table-level grant.

-- 2) Custom roles per server
CREATE TABLE IF NOT EXISTS public.hoa_server_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.hoa_servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  perm_send boolean NOT NULL DEFAULT true,
  perm_invite boolean NOT NULL DEFAULT false,
  perm_manage_roles boolean NOT NULL DEFAULT false,
  perm_manage_channels boolean NOT NULL DEFAULT false,
  perm_view_audit boolean NOT NULL DEFAULT false,
  perm_manage_api_key boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, name)
);
CREATE INDEX IF NOT EXISTS hoa_server_roles_server_idx ON public.hoa_server_roles(server_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hoa_server_roles TO authenticated;
GRANT ALL ON public.hoa_server_roles TO service_role;
ALTER TABLE public.hoa_server_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "server_roles_members_read" ON public.hoa_server_roles
  FOR SELECT TO authenticated
  USING (public.hoa_is_member(server_id, auth.uid()) OR public.hoa_is_houseofasher(auth.uid()));

CREATE POLICY "server_roles_owner_write" ON public.hoa_server_roles
  FOR ALL TO authenticated
  USING (public.hoa_member_role(server_id, auth.uid()) = 'owner'::hoa_server_role)
  WITH CHECK (public.hoa_member_role(server_id, auth.uid()) = 'owner'::hoa_server_role);

-- 3) Member ↔ role assignments
CREATE TABLE IF NOT EXISTS public.hoa_member_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.hoa_servers(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.hoa_members(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.hoa_server_roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, role_id)
);
CREATE INDEX IF NOT EXISTS hoa_member_roles_server_idx ON public.hoa_member_roles(server_id);
CREATE INDEX IF NOT EXISTS hoa_member_roles_member_idx ON public.hoa_member_roles(member_id);

GRANT SELECT, INSERT, DELETE ON public.hoa_member_roles TO authenticated;
GRANT ALL ON public.hoa_member_roles TO service_role;
ALTER TABLE public.hoa_member_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_roles_members_read" ON public.hoa_member_roles
  FOR SELECT TO authenticated
  USING (public.hoa_is_member(server_id, auth.uid()) OR public.hoa_is_houseofasher(auth.uid()));

CREATE POLICY "member_roles_owner_write" ON public.hoa_member_roles
  FOR ALL TO authenticated
  USING (public.hoa_member_role(server_id, auth.uid()) = 'owner'::hoa_server_role)
  WITH CHECK (public.hoa_member_role(server_id, auth.uid()) = 'owner'::hoa_server_role);

-- 4) Permission helper (owner always ok).
CREATE OR REPLACE FUNCTION public.hoa_has_permission(_server uuid, _user uuid, _perm text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
  ok boolean;
BEGIN
  SELECT (public.hoa_member_role(_server, _user) = 'owner'::hoa_server_role) INTO is_owner;
  IF is_owner THEN RETURN true; END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM public.hoa_member_roles mr
       JOIN public.hoa_server_roles r ON r.id = mr.role_id
       JOIN public.hoa_members m ON m.id = mr.member_id
       WHERE m.server_id = $1 AND m.user_id = $2 AND r.%I = true
     )',
     'perm_' || _perm
  ) USING _server, _user INTO ok;
  RETURN COALESCE(ok, false);
END $$;

-- 5) Audit filter index
CREATE INDEX IF NOT EXISTS hoa_audit_server_action_time
  ON public.hoa_audit (server_id, action, created_at DESC);
