
CREATE TABLE IF NOT EXISTS public.intel_memory_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canonical TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  attributes JSONB NOT NULL DEFAULT '{}',
  confidence TEXT NOT NULL DEFAULT 'REPORTED',
  hit_count INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(user_id, canonical)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intel_memory_entities TO authenticated;
GRANT ALL ON public.intel_memory_entities TO service_role;
ALTER TABLE public.intel_memory_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memory entities" ON public.intel_memory_entities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_intel_memory_entities_user_lastseen ON public.intel_memory_entities(user_id, last_seen DESC);

CREATE TABLE IF NOT EXISTS public.intel_memory_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_entity UUID NOT NULL REFERENCES public.intel_memory_entities(id) ON DELETE CASCADE,
  to_entity UUID NOT NULL REFERENCES public.intel_memory_entities(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  source_theory TEXT,
  confidence TEXT NOT NULL DEFAULT 'REPORTED',
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, from_entity, to_entity, relationship)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intel_memory_edges TO authenticated;
GRANT ALL ON public.intel_memory_edges TO service_role;
ALTER TABLE public.intel_memory_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memory edges" ON public.intel_memory_edges FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_intel_memory_edges_user_from ON public.intel_memory_edges(user_id, from_entity);

CREATE TABLE IF NOT EXISTS public.intel_autonomous_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  subject TEXT,
  kind TEXT,
  tools_fired TEXT[] NOT NULL DEFAULT '{}',
  consensus_score NUMERIC,
  entities_touched INTEGER NOT NULL DEFAULT 0,
  edges_created INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intel_autonomous_runs TO authenticated;
GRANT ALL ON public.intel_autonomous_runs TO service_role;
ALTER TABLE public.intel_autonomous_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own autonomous runs" ON public.intel_autonomous_runs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_intel_autonomous_runs_user_created ON public.intel_autonomous_runs(user_id, created_at DESC);
