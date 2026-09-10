CREATE TABLE public.osint_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  question text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','closed')),
  summary text,
  conversation_id uuid,
  provider_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_hop_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_investigations TO authenticated;
GRANT ALL ON public.osint_investigations TO service_role;
ALTER TABLE public.osint_investigations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investigations" ON public.osint_investigations
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX osint_investigations_user_idx ON public.osint_investigations (user_id, updated_at DESC);

CREATE TABLE public.osint_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text,
  title text NOT NULL,
  source_type text NOT NULL DEFAULT 'web_page',
  publisher text,
  provider text,
  published_at timestamptz,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  authority_tier smallint NOT NULL DEFAULT 3,
  authority_reason text,
  search_rank integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_sources TO authenticated;
GRANT ALL ON public.osint_sources TO service_role;
ALTER TABLE public.osint_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sources" ON public.osint_sources
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX osint_sources_inv_idx ON public.osint_sources (investigation_id, created_at DESC);

CREATE TABLE public.osint_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.osint_sources(id) ON DELETE SET NULL,
  filename text NOT NULL,
  mime_type text,
  byte_size integer,
  storage_path text,
  parse_status text NOT NULL DEFAULT 'unparsed'
    CHECK (parse_status IN ('parsed','unparsed','failed','unsupported')),
  parse_error text,
  text_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_documents TO authenticated;
GRANT ALL ON public.osint_documents TO service_role;
ALTER TABLE public.osint_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own documents" ON public.osint_documents
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX osint_documents_inv_idx ON public.osint_documents (investigation_id, created_at DESC);

CREATE TABLE public.osint_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NOT NULL,
  canonical text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution_state text NOT NULL DEFAULT 'candidate'
    CHECK (resolution_state IN ('candidate','resolved','merged','rejected')),
  merged_into uuid REFERENCES public.osint_entities(id) ON DELETE SET NULL,
  confidence numeric NOT NULL DEFAULT 0.3,
  origin text NOT NULL DEFAULT 'public_record'
    CHECK (origin IN ('public_record','user_document','sensor')),
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_entities TO authenticated;
GRANT ALL ON public.osint_entities TO service_role;
ALTER TABLE public.osint_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own entities" ON public.osint_entities
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE UNIQUE INDEX osint_entities_canonical_idx
  ON public.osint_entities (investigation_id, kind, canonical);

CREATE TABLE public.osint_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.osint_entities(id) ON DELETE CASCADE,
  kind text NOT NULL,
  value text NOT NULL,
  source_id uuid REFERENCES public.osint_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_identifiers TO authenticated;
GRANT ALL ON public.osint_identifiers TO service_role;
ALTER TABLE public.osint_identifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own identifiers" ON public.osint_identifiers
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE UNIQUE INDEX osint_identifiers_unique_idx
  ON public.osint_identifiers (entity_id, kind, value);

CREATE TABLE public.osint_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_entity_id uuid REFERENCES public.osint_entities(id) ON DELETE CASCADE,
  predicate text NOT NULL,
  object_entity_id uuid REFERENCES public.osint_entities(id) ON DELETE SET NULL,
  object_value text,
  statement text NOT NULL,
  claim_kind text NOT NULL DEFAULT 'observation'
    CHECK (claim_kind IN ('fact','observation','interpretation','hypothesis','inference','estimate','assumption','unknown')),
  status text NOT NULL DEFAULT 'unresolved'
    CHECK (status IN ('resolved','unresolved','contradicted','weak','retracted')),
  origin text NOT NULL DEFAULT 'public_record'
    CHECK (origin IN ('public_record','user_document','sensor')),
  valid_from timestamptz,
  valid_to timestamptz,
  volatility text NOT NULL DEFAULT 'slow' CHECK (volatility IN ('static','slow','volatile')),
  confidence numeric NOT NULL DEFAULT 0.2,
  confidence_reason text,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_claims TO authenticated;
GRANT ALL ON public.osint_claims TO service_role;
ALTER TABLE public.osint_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own claims" ON public.osint_claims
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX osint_claims_inv_idx ON public.osint_claims (investigation_id, created_at DESC);

CREATE TABLE public.osint_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.osint_claims(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.osint_sources(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.osint_documents(id) ON DELETE SET NULL,
  stance text NOT NULL CHECK (stance IN ('supports','contradicts','context')),
  excerpt text,
  locator text,
  authority_tier smallint NOT NULL DEFAULT 3,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_evidence TO authenticated;
GRANT ALL ON public.osint_evidence TO service_role;
ALTER TABLE public.osint_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own evidence" ON public.osint_evidence
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX osint_evidence_claim_idx ON public.osint_evidence (claim_id, stance);

CREATE TABLE public.osint_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_entity_id uuid NOT NULL REFERENCES public.osint_entities(id) ON DELETE CASCADE,
  to_entity_id uuid NOT NULL REFERENCES public.osint_entities(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  claim_id uuid REFERENCES public.osint_claims(id) ON DELETE SET NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  confidence numeric NOT NULL DEFAULT 0.2,
  status text NOT NULL DEFAULT 'unresolved'
    CHECK (status IN ('resolved','unresolved','contradicted','weak','retracted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_relationships TO authenticated;
GRANT ALL ON public.osint_relationships TO service_role;
ALTER TABLE public.osint_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own relationships" ON public.osint_relationships
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX osint_relationships_inv_idx ON public.osint_relationships (investigation_id);

CREATE TABLE public.osint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at timestamptz,
  date_precision text NOT NULL DEFAULT 'day'
    CHECK (date_precision IN ('exact','day','month','year','unknown')),
  label text NOT NULL,
  description text,
  entity_id uuid REFERENCES public.osint_entities(id) ON DELETE SET NULL,
  claim_id uuid REFERENCES public.osint_claims(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.osint_sources(id) ON DELETE SET NULL,
  origin text NOT NULL DEFAULT 'public_record'
    CHECK (origin IN ('public_record','user_document','sensor')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_events TO authenticated;
GRANT ALL ON public.osint_events TO service_role;
ALTER TABLE public.osint_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events" ON public.osint_events
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX osint_events_inv_idx ON public.osint_events (investigation_id, occurred_at);

CREATE TABLE public.osint_contradictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_a uuid NOT NULL REFERENCES public.osint_claims(id) ON DELETE CASCADE,
  claim_b uuid NOT NULL REFERENCES public.osint_claims(id) ON DELETE CASCADE,
  dimension text NOT NULL DEFAULT 'value',
  resolution text NOT NULL DEFAULT 'unresolved'
    CHECK (resolution IN ('unresolved','favored_a','favored_b','both_valid_different_periods')),
  resolution_reason text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_contradictions TO authenticated;
GRANT ALL ON public.osint_contradictions TO service_role;
ALTER TABLE public.osint_contradictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contradictions" ON public.osint_contradictions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE UNIQUE INDEX osint_contradictions_pair_idx
  ON public.osint_contradictions (investigation_id, claim_a, claim_b);

CREATE TABLE public.osint_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  gap_type text NOT NULL DEFAULT 'missing_evidence',
  priority smallint NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_gaps TO authenticated;
GRANT ALL ON public.osint_gaps TO service_role;
ALTER TABLE public.osint_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gaps" ON public.osint_gaps
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX osint_gaps_inv_idx ON public.osint_gaps (investigation_id, status, priority);

CREATE TABLE public.osint_hops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hop_number integer NOT NULL DEFAULT 1,
  phase text NOT NULL DEFAULT 'discover' CHECK (phase IN ('discover','connect','verify')),
  objective text NOT NULL,
  rationale text,
  target_entity_id uuid REFERENCES public.osint_entities(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','running','done','failed','unavailable','skipped')),
  provider_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_hops TO authenticated;
GRANT ALL ON public.osint_hops TO service_role;
ALTER TABLE public.osint_hops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hops" ON public.osint_hops
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX osint_hops_inv_idx ON public.osint_hops (investigation_id, hop_number);