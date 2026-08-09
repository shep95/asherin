CREATE TABLE public.augur_falsifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  -- Stable hash of (surface + prediction text). The same forecast restated on
  -- a later sweep must reuse its row, otherwise the hit rate is computed over
  -- duplicates and always looks better than it is.
  forecast_key text NOT NULL,
  surface text NOT NULL DEFAULT 'augur',
  prediction text NOT NULL,
  falsifier text NOT NULL,
  confidence integer NOT NULL DEFAULT 0,
  horizon_days integer NOT NULL DEFAULT 7,
  status text NOT NULL DEFAULT 'open',
  evidence text,
  checks integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, forecast_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.augur_falsifiers TO authenticated;
GRANT ALL ON public.augur_falsifiers TO service_role;

ALTER TABLE public.augur_falsifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own forecast ledger"
  ON public.augur_falsifiers FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX augur_falsifiers_open_idx
  ON public.augur_falsifiers (user_id, status, created_at DESC);

CREATE TRIGGER augur_falsifiers_updated_at
  BEFORE UPDATE ON public.augur_falsifiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();