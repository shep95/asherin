-- ═══════════════════════════════════════════════════════════════════════
-- THE ORGANISM — private per-user vault + self-minted pattern library
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE public.organism_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  facet text NOT NULL DEFAULT 'context',
  label text NOT NULL DEFAULT '',
  content text NOT NULL,
  fingerprint text NOT NULL,
  sensitive boolean NOT NULL DEFAULT false,
  encrypted boolean NOT NULL DEFAULT false,
  confidence numeric NOT NULL DEFAULT 0.6,
  occurrences integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'harvest',
  conversation_id uuid,
  enabled boolean NOT NULL DEFAULT true,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organism_vault_facet_chk CHECK (facet IN (
    'interest','thinking','work','style','preference','correction',
    'emotion','expertise','goal','secret','context','directive'
  )),
  CONSTRAINT organism_vault_uniq UNIQUE (user_id, fingerprint)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organism_vault TO authenticated;
GRANT ALL ON public.organism_vault TO service_role;
ALTER TABLE public.organism_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vault" ON public.organism_vault FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX organism_vault_user_idx ON public.organism_vault (user_id, enabled, last_seen DESC);

CREATE TABLE public.organism_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  domain text NOT NULL DEFAULT 'general',
  trigger text NOT NULL DEFAULT '',
  procedure text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  potency numeric NOT NULL DEFAULT 0.5,
  uses integer NOT NULL DEFAULT 0,
  generation integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organism_patterns_uniq UNIQUE (user_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organism_patterns TO authenticated;
GRANT ALL ON public.organism_patterns TO service_role;
ALTER TABLE public.organism_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own patterns" ON public.organism_patterns FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX organism_patterns_user_idx ON public.organism_patterns (user_id, active, potency DESC);

CREATE TABLE public.organism_growth (
  user_id uuid PRIMARY KEY,
  sessions integer NOT NULL DEFAULT 0,
  entries integer NOT NULL DEFAULT 0,
  patterns integer NOT NULL DEFAULT 0,
  density numeric NOT NULL DEFAULT 0,
  last_grown_at timestamptz,
  last_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organism_growth TO authenticated;
GRANT ALL ON public.organism_growth TO service_role;
ALTER TABLE public.organism_growth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own growth" ON public.organism_growth FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER organism_vault_touch BEFORE UPDATE ON public.organism_vault
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER organism_patterns_touch BEFORE UPDATE ON public.organism_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER organism_growth_touch BEFORE UPDATE ON public.organism_growth
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Migrate what already exists into the vault ─────────────────────────
INSERT INTO public.organism_vault
  (user_id, facet, label, content, fingerprint, source, enabled, confidence, created_at, first_seen, last_seen)
SELECT
  m.user_id,
  CASE
    WHEN COALESCE(m.category, '') IN ('preferences','preference') THEN 'preference'
    WHEN COALESCE(m.category, '') = 'technical' THEN 'expertise'
    ELSE 'context'
  END,
  left(m.content, 80),
  m.content,
  md5(m.user_id::text || lower(btrim(m.content))),
  'migrated:memory_entries',
  COALESCE(m.enabled, true),
  0.7,
  m.created_at, m.created_at, m.created_at
FROM public.memory_entries m
WHERE btrim(COALESCE(m.content, '')) <> ''
ON CONFLICT (user_id, fingerprint) DO NOTHING;

INSERT INTO public.organism_vault
  (user_id, facet, label, content, fingerprint, source, confidence)
SELECT
  p.user_id, 'style', 'tone preference',
  'prefers ' || p.tone_preference || ' communication',
  md5(p.user_id::text || 'tone:' || p.tone_preference),
  'migrated:profile', 0.65
FROM public.user_intelligence_profile p
WHERE COALESCE(p.tone_preference, 'neutral') <> 'neutral'
ON CONFLICT (user_id, fingerprint) DO NOTHING;

INSERT INTO public.organism_vault
  (user_id, facet, label, content, fingerprint, source, confidence)
SELECT
  p.user_id, 'interest', 'topics of interest',
  'works on / cares about: ' || array_to_string(p.topics_of_interest, ', '),
  md5(p.user_id::text || 'topics:' || array_to_string(p.topics_of_interest, ',')),
  'migrated:profile', 0.6
FROM public.user_intelligence_profile p
WHERE p.topics_of_interest IS NOT NULL AND array_length(p.topics_of_interest, 1) > 0
ON CONFLICT (user_id, fingerprint) DO NOTHING;

INSERT INTO public.organism_vault
  (user_id, facet, label, content, fingerprint, source, enabled, confidence, created_at, first_seen, last_seen)
SELECT
  b.user_id, 'directive', left(b.name, 80), b.system_prompt,
  md5(b.user_id::text || lower(btrim(b.system_prompt))),
  'migrated:brains', COALESCE(b.is_active, false), 0.8,
  b.created_at, b.created_at, b.created_at
FROM public.brains b
WHERE btrim(COALESCE(b.system_prompt, '')) <> ''
ON CONFLICT (user_id, fingerprint) DO NOTHING;

-- ── Retire the old memory surfaces ─────────────────────────────────────
DROP TABLE IF EXISTS public.memory_entries CASCADE;
DROP TABLE IF EXISTS public.user_intelligence_profile CASCADE;
DROP TABLE IF EXISTS public.brains CASCADE;