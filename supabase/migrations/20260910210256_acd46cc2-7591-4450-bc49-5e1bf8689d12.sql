-- ============ Asherin intelligence infrastructure ============

-- shared updated_at helper already exists as public.update_updated_at_column in most cases;
-- create defensively.
CREATE OR REPLACE FUNCTION public.ai_touch_updated_at()
RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- ---------- settings ----------
CREATE TABLE public.ai_intelligence_settings (
  user_id uuid NOT NULL PRIMARY KEY,
  memory_enabled boolean NOT NULL DEFAULT false,
  learning_enabled boolean NOT NULL DEFAULT true,
  global_contribution_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_intelligence_settings TO authenticated;
GRANT ALL ON public.ai_intelligence_settings TO service_role;
ALTER TABLE public.ai_intelligence_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.ai_intelligence_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_ai_settings_updated BEFORE UPDATE ON public.ai_intelligence_settings
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();

-- ---------- conversation state ----------
CREATE TABLE public.ai_conversation_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  conversation_id text NOT NULL,
  project_id uuid,
  goal text,
  active_topic text,
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferences_observed jsonb NOT NULL DEFAULT '[]'::jsonb,
  patterns_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  patterns_created jsonb NOT NULL DEFAULT '[]'::jsonb,
  patterns_rejected jsonb NOT NULL DEFAULT '[]'::jsonb,
  feedback jsonb NOT NULL DEFAULT '[]'::jsonb,
  artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  unresolved_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_state text NOT NULL DEFAULT 'active',
  confidence numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, conversation_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversation_state TO authenticated;
GRANT ALL ON public.ai_conversation_state TO service_role;
ALTER TABLE public.ai_conversation_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversation state" ON public.ai_conversation_state FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_ai_conv_state_updated BEFORE UPDATE ON public.ai_conversation_state
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
CREATE INDEX idx_ai_conv_state_user ON public.ai_conversation_state (user_id, conversation_id);

-- ---------- user memory ----------
CREATE TABLE public.ai_user_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'general',
  scope text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  rationale text,
  confidence numeric NOT NULL DEFAULT 0.5,
  evidence_count integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'conversation',
  source_conversation_id text,
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_user_memory TO authenticated;
GRANT ALL ON public.ai_user_memory TO service_role;
ALTER TABLE public.ai_user_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own user memory" ON public.ai_user_memory FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_ai_user_memory_updated BEFORE UPDATE ON public.ai_user_memory
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
CREATE INDEX idx_ai_user_memory_user ON public.ai_user_memory (user_id, status);

-- ---------- project memory ----------
CREATE TABLE public.ai_project_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  rationale text,
  confidence numeric NOT NULL DEFAULT 0.5,
  evidence_count integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'conversation',
  source_conversation_id text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_project_memory TO authenticated;
GRANT ALL ON public.ai_project_memory TO service_role;
ALTER TABLE public.ai_project_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own project memory" ON public.ai_project_memory FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_ai_project_memory_updated BEFORE UPDATE ON public.ai_project_memory
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
CREATE INDEX idx_ai_project_memory_scope ON public.ai_project_memory (user_id, project_id, status);

-- ---------- memory candidates ----------
CREATE TABLE public.ai_memory_candidate (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  conversation_id text,
  project_id uuid,
  proposed_scope text NOT NULL DEFAULT 'conversation',
  kind text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  rationale text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric NOT NULL DEFAULT 0.3,
  status text NOT NULL DEFAULT 'pending',
  decision_reason text,
  promoted_to text,
  promoted_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_memory_candidate TO authenticated;
GRANT ALL ON public.ai_memory_candidate TO service_role;
ALTER TABLE public.ai_memory_candidate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memory candidates" ON public.ai_memory_candidate FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_ai_mem_cand_updated BEFORE UPDATE ON public.ai_memory_candidate
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
CREATE INDEX idx_ai_mem_cand_user ON public.ai_memory_candidate (user_id, status);

-- ---------- pattern registry ----------
CREATE TABLE public.ai_pattern (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  domain text NOT NULL DEFAULT 'general',
  subdomain text,
  family text,
  abstraction_level text NOT NULL DEFAULT 'concrete',
  scope text NOT NULL DEFAULT 'conversation',
  conversation_id text,
  project_id uuid,
  trigger_terms text[] NOT NULL DEFAULT '{}',
  inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  preconditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  mechanism text,
  procedure jsonb NOT NULL DEFAULT '[]'::jsonb,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_output text,
  failure_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_quality text NOT NULL DEFAULT 'weak',
  confidence numeric NOT NULL DEFAULT 0.2,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  contexts_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'candidate',
  source text NOT NULL DEFAULT 'conversation',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_pattern TO authenticated;
GRANT ALL ON public.ai_pattern TO service_role;
ALTER TABLE public.ai_pattern ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own patterns" ON public.ai_pattern FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_ai_pattern_updated BEFORE UPDATE ON public.ai_pattern
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
CREATE INDEX idx_ai_pattern_user_status ON public.ai_pattern (user_id, status, scope);
CREATE INDEX idx_ai_pattern_triggers ON public.ai_pattern USING gin (trigger_terms);

-- ---------- pattern graph edges ----------
CREATE TABLE public.ai_pattern_edge (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  from_pattern_id uuid NOT NULL REFERENCES public.ai_pattern(id) ON DELETE CASCADE,
  to_pattern_id uuid NOT NULL REFERENCES public.ai_pattern(id) ON DELETE CASCADE,
  relation text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_pattern_id, to_pattern_id, relation)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_pattern_edge TO authenticated;
GRANT ALL ON public.ai_pattern_edge TO service_role;
ALTER TABLE public.ai_pattern_edge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pattern edges" ON public.ai_pattern_edge FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- pattern versions ----------
CREATE TABLE public.ai_pattern_version (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pattern_id uuid NOT NULL REFERENCES public.ai_pattern(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pattern_id, version)
);
GRANT SELECT, INSERT ON public.ai_pattern_version TO authenticated;
GRANT ALL ON public.ai_pattern_version TO service_role;
ALTER TABLE public.ai_pattern_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pattern versions read" ON public.ai_pattern_version FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "own pattern versions write" ON public.ai_pattern_version FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ---------- pattern outcomes ----------
CREATE TABLE public.ai_pattern_outcome (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pattern_id uuid NOT NULL REFERENCES public.ai_pattern(id) ON DELETE CASCADE,
  conversation_id text,
  result text NOT NULL,
  signal text,
  detail text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ai_pattern_outcome TO authenticated;
GRANT ALL ON public.ai_pattern_outcome TO service_role;
ALTER TABLE public.ai_pattern_outcome ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pattern outcomes" ON public.ai_pattern_outcome FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- learning events ----------
CREATE TABLE public.ai_learning_event (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  conversation_id text,
  stage text NOT NULL,
  decision text NOT NULL,
  subject_type text NOT NULL,
  subject_id uuid,
  reason text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ai_learning_event TO authenticated;
GRANT ALL ON public.ai_learning_event TO service_role;
ALTER TABLE public.ai_learning_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own learning events" ON public.ai_learning_event FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_ai_learning_event_user ON public.ai_learning_event (user_id, created_at DESC);

-- ---------- global quarantine (no user/project identifiers) ----------
CREATE TABLE public.ai_global_candidate (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint text NOT NULL,
  name text NOT NULL,
  domain text NOT NULL DEFAULT 'general',
  abstraction_level text NOT NULL DEFAULT 'abstract',
  mechanism text NOT NULL,
  procedure jsonb NOT NULL DEFAULT '[]'::jsonb,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  failure_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  independent_sources integer NOT NULL DEFAULT 1,
  evidence_score numeric NOT NULL DEFAULT 0,
  privacy_checked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'quarantined',
  review_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  period text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_global_candidate TO authenticated;
GRANT ALL ON public.ai_global_candidate TO service_role;
ALTER TABLE public.ai_global_candidate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global candidates readable" ON public.ai_global_candidate FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_ai_global_cand_updated BEFORE UPDATE ON public.ai_global_candidate
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
CREATE UNIQUE INDEX idx_ai_global_cand_fingerprint ON public.ai_global_candidate (fingerprint);

CREATE TABLE public.ai_global_pattern (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint text NOT NULL,
  name text NOT NULL,
  domain text NOT NULL DEFAULT 'general',
  layer text NOT NULL DEFAULT 'experimental',
  mechanism text NOT NULL,
  procedure jsonb NOT NULL DEFAULT '[]'::jsonb,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  failure_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluation jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid,
  retired_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fingerprint, version)
);
GRANT SELECT ON public.ai_global_pattern TO authenticated;
GRANT ALL ON public.ai_global_pattern TO service_role;
ALTER TABLE public.ai_global_pattern ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global patterns readable" ON public.ai_global_pattern FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_ai_global_pattern_updated BEFORE UPDATE ON public.ai_global_pattern
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();

CREATE TABLE public.ai_global_manifest (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period text NOT NULL UNIQUE,
  evaluated integer NOT NULL DEFAULT 0,
  new_candidates integer NOT NULL DEFAULT 0,
  duplicates_merged integer NOT NULL DEFAULT 0,
  promoted integer NOT NULL DEFAULT 0,
  refined integer NOT NULL DEFAULT 0,
  experimental integer NOT NULL DEFAULT 0,
  rejected integer NOT NULL DEFAULT 0,
  retired integer NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_global_manifest TO authenticated;
GRANT ALL ON public.ai_global_manifest TO service_role;
ALTER TABLE public.ai_global_manifest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global manifests readable" ON public.ai_global_manifest FOR SELECT TO authenticated USING (true);