CREATE TABLE public.artifact_session (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID,
  project_id UUID,
  title TEXT NOT NULL DEFAULT 'untitled artifact',
  modality TEXT NOT NULL DEFAULT 'unknown',
  capability TEXT NOT NULL DEFAULT 'validate_only',
  capability_reason TEXT,
  lifecycle TEXT NOT NULL DEFAULT 'draft',
  lifecycle_reason TEXT,
  active_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artifact_session TO authenticated;
GRANT ALL ON public.artifact_session TO service_role;
ALTER TABLE public.artifact_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own artifact sessions" ON public.artifact_session FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX artifact_session_user_idx ON public.artifact_session (user_id, updated_at DESC);
CREATE INDEX artifact_session_conversation_idx ON public.artifact_session (conversation_id);

CREATE TABLE public.artifact_version (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.artifact_session(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  parent_version INTEGER,
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  runtime_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT,
  reason TEXT,
  feedback_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (session_id, version)
);
GRANT SELECT, INSERT ON public.artifact_version TO authenticated;
GRANT ALL ON public.artifact_version TO service_role;
ALTER TABLE public.artifact_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own artifact versions" ON public.artifact_version FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "append own artifact versions" ON public.artifact_version FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.artifact_contract (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.artifact_session(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0,
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_behavior JSONB NOT NULL DEFAULT '[]'::jsonb,
  interface JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  invariants JSONB NOT NULL DEFAULT '[]'::jsonb,
  acceptance JSONB NOT NULL DEFAULT '[]'::jsonb,
  test_model JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artifact_contract TO authenticated;
GRANT ALL ON public.artifact_contract TO service_role;
ALTER TABLE public.artifact_contract ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own artifact contracts" ON public.artifact_contract FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.artifact_observation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.artifact_session(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0,
  channel TEXT NOT NULL,
  source TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.artifact_observation TO authenticated;
GRANT ALL ON public.artifact_observation TO service_role;
ALTER TABLE public.artifact_observation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own artifact observations" ON public.artifact_observation FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX artifact_observation_session_idx ON public.artifact_observation (session_id, version);

CREATE TABLE public.artifact_validation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.artifact_session(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'unvalidated',
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  defects JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.artifact_validation TO authenticated;
GRANT ALL ON public.artifact_validation TO service_role;
ALTER TABLE public.artifact_validation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own artifact validations" ON public.artifact_validation FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.artifact_repair (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.artifact_session(id) ON DELETE CASCADE,
  from_version INTEGER NOT NULL DEFAULT 0,
  to_version INTEGER,
  scope TEXT NOT NULL DEFAULT 'property',
  diagnosis TEXT NOT NULL DEFAULT '',
  hypotheses JSONB NOT NULL DEFAULT '[]'::jsonb,
  change_set JSONB NOT NULL DEFAULT '[]'::jsonb,
  rerun_result TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.artifact_repair TO authenticated;
GRANT ALL ON public.artifact_repair TO service_role;
ALTER TABLE public.artifact_repair ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own artifact repairs" ON public.artifact_repair FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.artifact_experience (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.artifact_session(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0,
  task TEXT NOT NULL DEFAULT '',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  initial_model JSONB NOT NULL DEFAULT '{}'::jsonb,
  patterns_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  observations JSONB NOT NULL DEFAULT '[]'::jsonb,
  defects JSONB NOT NULL DEFAULT '[]'::jsonb,
  repairs JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_feedback TEXT,
  outcome TEXT NOT NULL DEFAULT 'unknown',
  pattern_id UUID,
  learning_event_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.artifact_experience TO authenticated;
GRANT ALL ON public.artifact_experience TO service_role;
ALTER TABLE public.artifact_experience ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own artifact experience" ON public.artifact_experience FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER artifact_session_touch BEFORE UPDATE ON public.artifact_session FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
CREATE TRIGGER artifact_contract_touch BEFORE UPDATE ON public.artifact_contract FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();