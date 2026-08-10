-- ═══════════════════════════════════════════════════════════════════════
-- THE BLOODSTREAM — one shared substance moving through every organ.
-- Entities are memory, events are circulation, findings are the brain's
-- output, outcomes are homeostasis, and every row carries its own death
-- date so forgetting is a property of the organism, not of one module.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE public.organism_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('person','email','phone','domain','network','device','radio','credential','place','org')),
  -- normalised, lowercase, comparison-stable identity of the thing itself
  entity_key TEXT NOT NULL,
  label TEXT,
  -- ONE shared 0..1 confidence scale for the whole organism
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.300 CHECK (confidence >= 0 AND confidence <= 1),
  -- how many DISTINCT organs have independently reported this entity
  corroboration INTEGER NOT NULL DEFAULT 1 CHECK (corroboration >= 0),
  organs TEXT[] NOT NULL DEFAULT '{}',
  -- immune model: is this part of the operator, or reaching in from outside
  self_status TEXT NOT NULL DEFAULT 'unknown' CHECK (self_status IN ('self','trusted','unknown','suspect','hostile')),
  -- confidence decays unless re-corroborated; half-life is per-kind
  half_life_hours INTEGER NOT NULL DEFAULT 336 CHECK (half_life_hours BETWEEN 1 AND 87600),
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_decayed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, entity_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organism_entities TO authenticated;
GRANT ALL ON public.organism_entities TO service_role;
ALTER TABLE public.organism_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organism_entities_own" ON public.organism_entities FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX organism_entities_user_seen_idx ON public.organism_entities (user_id, last_seen DESC);
CREATE INDEX organism_entities_expiry_idx ON public.organism_entities (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX organism_entities_status_idx ON public.organism_entities (user_id, self_status);

-- ── circulation ────────────────────────────────────────────────────────
CREATE TABLE public.organism_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organ TEXT NOT NULL,
  kind TEXT NOT NULL,
  entity_id UUID REFERENCES public.organism_entities(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL DEFAULT 'unknown' CHECK (verdict IN ('clean','benign','anomalous','hostile','unknown')),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.300 CHECK (confidence >= 0 AND confidence <= 1),
  -- reflex arcs fire before the brain sees them; considered events do not
  reflex BOOLEAN NOT NULL DEFAULT false,
  summary TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- source clock, not the browser clock
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '45 days'),
  -- stable dedupe key so the same sensation reported twice is one event
  dedupe_key TEXT,
  UNIQUE (user_id, organ, dedupe_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organism_events TO authenticated;
GRANT ALL ON public.organism_events TO service_role;
ALTER TABLE public.organism_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organism_events_own" ON public.organism_events FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX organism_events_user_time_idx ON public.organism_events (user_id, observed_at DESC);
CREATE INDEX organism_events_entity_idx ON public.organism_events (entity_id, observed_at DESC);
CREATE INDEX organism_events_expiry_idx ON public.organism_events (expires_at);

-- ── associative memory ─────────────────────────────────────────────────
CREATE TABLE public.organism_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_id UUID NOT NULL REFERENCES public.organism_entities(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.organism_entities(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.300 CHECK (confidence >= 0 AND confidence <= 1),
  corroboration INTEGER NOT NULL DEFAULT 1 CHECK (corroboration >= 0),
  organs TEXT[] NOT NULL DEFAULT '{}',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_id, target_id, relation)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organism_links TO authenticated;
GRANT ALL ON public.organism_links TO service_role;
ALTER TABLE public.organism_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organism_links_own" ON public.organism_links FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX organism_links_user_idx ON public.organism_links (user_id, last_seen DESC);

-- ── the brain's output ─────────────────────────────────────────────────
CREATE TABLE public.organism_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  story_key TEXT NOT NULL,
  title TEXT NOT NULL,
  narrative TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  tier TEXT NOT NULL DEFAULT 'log' CHECK (tier IN ('log','advise','act')),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.300 CHECK (confidence >= 0 AND confidence <= 1),
  corroboration INTEGER NOT NULL DEFAULT 1 CHECK (corroboration >= 0),
  organs TEXT[] NOT NULL DEFAULT '{}',
  entity_ids UUID[] NOT NULL DEFAULT '{}',
  event_ids UUID[] NOT NULL DEFAULT '{}',
  -- homeostasis: nothing ships without the thing that would disprove it
  falsifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','stood_down','confirmed','expired','acknowledged')),
  reflex_origin BOOLEAN NOT NULL DEFAULT false,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, story_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organism_findings TO authenticated;
GRANT ALL ON public.organism_findings TO service_role;
ALTER TABLE public.organism_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organism_findings_own" ON public.organism_findings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX organism_findings_user_idx ON public.organism_findings (user_id, status, last_seen DESC);

-- ── homeostasis ledger ─────────────────────────────────────────────────
CREATE TABLE public.organism_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  finding_id UUID REFERENCES public.organism_findings(id) ON DELETE CASCADE,
  organ TEXT NOT NULL,
  predicted_confidence NUMERIC(4,3) NOT NULL CHECK (predicted_confidence >= 0 AND predicted_confidence <= 1),
  falsifier TEXT NOT NULL,
  resolution TEXT NOT NULL DEFAULT 'pending' CHECK (resolution IN ('pending','held','falsified','withdrawn')),
  note TEXT,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organism_outcomes TO authenticated;
GRANT ALL ON public.organism_outcomes TO service_role;
ALTER TABLE public.organism_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organism_outcomes_own" ON public.organism_outcomes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX organism_outcomes_user_idx ON public.organism_outcomes (user_id, created_at DESC);

-- ── vitals ─────────────────────────────────────────────────────────────
CREATE TABLE public.organism_state (
  user_id UUID NOT NULL PRIMARY KEY,
  last_metabolism_at TIMESTAMPTZ,
  last_correlation_at TIMESTAMPTZ,
  events_ingested BIGINT NOT NULL DEFAULT 0,
  events_purged BIGINT NOT NULL DEFAULT 0,
  calibration NUMERIC(4,3) NOT NULL DEFAULT 0.500 CHECK (calibration >= 0 AND calibration <= 1),
  vitals JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organism_state TO authenticated;
GRANT ALL ON public.organism_state TO service_role;
ALTER TABLE public.organism_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organism_state_own" ON public.organism_state FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── shed cells on a schedule (called by the metabolism pass) ───────────
CREATE OR REPLACE FUNCTION public.organism_purge()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purged INTEGER := 0;
  n INTEGER;
BEGIN
  DELETE FROM public.organism_events WHERE expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT; purged := purged + n;

  UPDATE public.organism_findings SET status = 'expired', updated_at = now()
   WHERE status = 'open' AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT; purged := purged + n;

  -- an entity nobody has corroborated and whose confidence has decayed to
  -- irrelevance is a cell the body no longer maintains
  DELETE FROM public.organism_entities
   WHERE (expires_at IS NOT NULL AND expires_at < now())
      OR (confidence < 0.05 AND last_seen < now() - INTERVAL '90 days' AND self_status NOT IN ('self','trusted','hostile'));
  GET DIAGNOSTICS n = ROW_COUNT; purged := purged + n;

  RETURN purged;
END;
$$;

REVOKE ALL ON FUNCTION public.organism_purge() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organism_purge() TO service_role;