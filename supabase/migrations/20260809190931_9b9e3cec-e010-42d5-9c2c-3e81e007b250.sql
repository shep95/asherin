CREATE TABLE public.zophiel_query_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query text NOT NULL,
  mode text,
  query_shape text,
  entity_kind text,
  result_count integer NOT NULL DEFAULT 0,
  avg_relevance numeric NOT NULL DEFAULT 0,
  on_target_rate numeric NOT NULL DEFAULT 0,
  rescue_used boolean NOT NULL DEFAULT false,
  engine_hit_rate jsonb NOT NULL DEFAULT '{}'::jsonb,
  independence_classes jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_type_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  contradiction_count integer NOT NULL DEFAULT 0,
  claim_count integer NOT NULL DEFAULT 0,
  clicked_url text,
  clicked_rank integer,
  operator_rating smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zophiel_query_outcomes TO authenticated;
GRANT ALL ON public.zophiel_query_outcomes TO service_role;

ALTER TABLE public.zophiel_query_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their own query outcomes"
  ON public.zophiel_query_outcomes FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX zophiel_query_outcomes_user_created_idx
  ON public.zophiel_query_outcomes (user_id, created_at DESC);