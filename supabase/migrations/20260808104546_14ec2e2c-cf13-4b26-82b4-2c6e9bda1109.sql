CREATE TABLE public.ghost_entity_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_key TEXT NOT NULL,
  entity_kind TEXT NOT NULL,
  entity_label TEXT NOT NULL,
  query TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all',
  leads_found INTEGER NOT NULL DEFAULT 0,
  probed INTEGER NOT NULL DEFAULT 0,
  anomalies INTEGER NOT NULL DEFAULT 0,
  elapsed_ms INTEGER NOT NULL DEFAULT 0,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghost_entity_history TO authenticated;
GRANT ALL ON public.ghost_entity_history TO service_role;

ALTER TABLE public.ghost_entity_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ghost_history owner read"   ON public.ghost_entity_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ghost_history owner write"  ON public.ghost_entity_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ghost_history owner delete" ON public.ghost_entity_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX ghost_history_user_time_idx   ON public.ghost_entity_history (user_id, created_at DESC);
CREATE INDEX ghost_history_user_entity_idx ON public.ghost_entity_history (user_id, entity_key, created_at DESC);