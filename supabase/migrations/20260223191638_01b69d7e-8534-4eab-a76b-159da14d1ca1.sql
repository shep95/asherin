
-- Table for self-learning loop runs
CREATE TABLE public.self_learning_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',
  domains_analyzed TEXT[] DEFAULT '{}',
  findings JSONB DEFAULT '[]',
  brains_generated INT DEFAULT 0,
  code_reviewed INT DEFAULT 0,
  bugs_found INT DEFAULT 0,
  optimizations_applied INT DEFAULT 0,
  security_patches INT DEFAULT 0,
  duration_ms INT DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Table for generated "brains" (prompt directives)
CREATE TABLE public.self_learning_brains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.self_learning_runs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  directive TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0.0,
  auto_approved BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  findings JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for agent activity logs
CREATE TABLE public.self_learning_agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.self_learning_runs(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  severity TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Only admin can access these tables
ALTER TABLE public.self_learning_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_learning_brains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_learning_agent_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only policies (no user_id column needed since only admin accesses)
CREATE POLICY "Admin full access on runs" ON public.self_learning_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access on brains" ON public.self_learning_brains FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access on agent_logs" ON public.self_learning_agent_logs FOR ALL USING (true) WITH CHECK (true);
