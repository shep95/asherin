
CREATE TABLE public.nomad_entity_graph (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  investigation_id UUID REFERENCES public.nomad_investigations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_value TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0,
  source TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  frequency INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nomad_entity_graph_user_id ON public.nomad_entity_graph(user_id);
CREATE INDEX idx_nomad_entity_graph_entity ON public.nomad_entity_graph(entity_type, entity_value);
CREATE INDEX idx_nomad_entity_graph_investigation ON public.nomad_entity_graph(investigation_id);

ALTER TABLE public.nomad_entity_graph ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own entity graph"
  ON public.nomad_entity_graph
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
