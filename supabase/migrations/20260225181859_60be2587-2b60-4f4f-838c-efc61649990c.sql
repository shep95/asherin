
-- Persistent coding laws table
CREATE TABLE public.coding_laws (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  law_number TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  law TEXT NOT NULL,
  era TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'standard',
  active BOOLEAN NOT NULL DEFAULT true,
  rationale TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'seed',
  generation_method TEXT DEFAULT NULL,
  parent_law_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coding_laws ENABLE ROW LEVEL SECURITY;

-- Laws are readable by all authenticated users (they govern all code generation)
CREATE POLICY "Anyone can read coding laws"
  ON public.coding_laws FOR SELECT
  USING (true);

-- Only the system (service role) inserts/updates laws via edge function
-- No user insert/update/delete policies needed

-- Index for fast lookups
CREATE INDEX idx_coding_laws_active ON public.coding_laws (active);
CREATE INDEX idx_coding_laws_domain ON public.coding_laws (domain);
CREATE INDEX idx_coding_laws_source ON public.coding_laws (source);

-- Auto-update timestamp
CREATE TRIGGER update_coding_laws_updated_at
  BEFORE UPDATE ON public.coding_laws
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Engine run log
CREATE TABLE public.coding_laws_engine_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT NOT NULL DEFAULT 'scheduled',
  laws_discovered INTEGER NOT NULL DEFAULT 0,
  laws_cross_referenced INTEGER NOT NULL DEFAULT 0,
  laws_created INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coding_laws_engine_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read engine runs"
  ON public.coding_laws_engine_runs FOR SELECT
  USING (true);
