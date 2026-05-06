-- ============================================================
-- ASHER AGENTS (ZAHTEN-built tabs) + AGENT RUNS (Zacoon traces)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.asher_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT '◈',
  category text NOT NULL DEFAULT 'custom',
  runtime text NOT NULL DEFAULT 'iframe' CHECK (runtime IN ('iframe','react')),
  entry_html text,
  source_tsx text,
  system_prompt text,
  brain_categories text[] NOT NULL DEFAULT ARRAY[]::text[],
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','team','organization','public')),
  org_id uuid,
  team_id uuid,
  install_count int NOT NULL DEFAULT 0,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asher_agents_owner ON public.asher_agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_asher_agents_visibility ON public.asher_agents(visibility, status);
CREATE INDEX IF NOT EXISTS idx_asher_agents_org ON public.asher_agents(org_id) WHERE org_id IS NOT NULL;

ALTER TABLE public.asher_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_owner_all" ON public.asher_agents
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "agents_super_owner_all" ON public.asher_agents
  FOR ALL USING (public.is_asher_super_owner(auth.uid()))
  WITH CHECK (public.is_asher_super_owner(auth.uid()));

CREATE POLICY "agents_public_read" ON public.asher_agents
  FOR SELECT USING (visibility = 'public' AND status = 'published');

CREATE POLICY "agents_org_read" ON public.asher_agents
  FOR SELECT USING (
    visibility = 'organization'
    AND status = 'published'
    AND org_id IS NOT NULL
    AND public.asher_is_org_member(auth.uid(), org_id)
  );

CREATE POLICY "agents_team_read" ON public.asher_agents
  FOR SELECT USING (
    visibility = 'team'
    AND status = 'published'
    AND team_id IS NOT NULL
    AND public.is_team_member(auth.uid(), team_id)
  );

CREATE TRIGGER tr_asher_agents_touch
  BEFORE UPDATE ON public.asher_agents
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ------------------------------------------------------------
-- Agent / Zacoon run history
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asher_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid REFERENCES public.asher_agents(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'zacoon',
  task text NOT NULL,
  target_url text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed','aborted')),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  output jsonb,
  findings jsonb,
  error text,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON public.asher_agent_runs(user_id, created_at DESC);

ALTER TABLE public.asher_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runs_owner_all" ON public.asher_agent_runs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "runs_super_owner_read" ON public.asher_agent_runs
  FOR SELECT USING (public.is_asher_super_owner(auth.uid()));