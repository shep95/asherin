
CREATE TABLE public.search_discover_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  seed text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('discover','identity','paste')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','error')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  error text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_discover_runs TO authenticated;
GRANT ALL ON public.search_discover_runs TO service_role;
ALTER TABLE public.search_discover_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own runs" ON public.search_discover_runs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_search_runs_user ON public.search_discover_runs(user_id, started_at DESC);

CREATE TABLE public.search_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.search_discover_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  source text NOT NULL,
  url text,
  kind text NOT NULL,
  exposure_class text,
  sensitivity int NOT NULL DEFAULT 0,
  live boolean,
  http_status int,
  content_type text,
  language text,
  first_seen_at timestamptz,
  last_probed_at timestamptz NOT NULL DEFAULT now(),
  evidence_excerpt text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_hits TO authenticated;
GRANT ALL ON public.search_hits TO service_role;
ALTER TABLE public.search_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hits" ON public.search_hits FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_search_hits_run ON public.search_hits(run_id, sensitivity DESC);
CREATE INDEX idx_search_hits_user ON public.search_hits(user_id, last_probed_at DESC);

CREATE TABLE public.search_identity_pivots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.search_discover_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_node text,
  node_id text NOT NULL,
  identifier text NOT NULL,
  kind text NOT NULL,
  depth int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_identity_pivots TO authenticated;
GRANT ALL ON public.search_identity_pivots TO service_role;
ALTER TABLE public.search_identity_pivots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pivots" ON public.search_identity_pivots FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_search_pivots_run ON public.search_identity_pivots(run_id, depth);
