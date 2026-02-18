
-- Investigation history
CREATE TABLE public.nomad_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  query TEXT NOT NULL,
  investigation_type TEXT DEFAULT 'general',
  sources_checked TEXT[] DEFAULT '{}',
  findings TEXT NOT NULL,
  entities_found JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nomad_investigations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own investigations"
  ON public.nomad_investigations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Extracted entities from investigations
CREATE TABLE public.nomad_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.nomad_investigations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_value TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0.8,
  source TEXT DEFAULT 'nomad-investigation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nomad_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own nomad entities"
  ON public.nomad_entities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_nomad_investigations_user ON public.nomad_investigations(user_id);
CREATE INDEX idx_nomad_entities_investigation ON public.nomad_entities(investigation_id);
