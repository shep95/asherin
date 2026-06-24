CREATE TABLE public.asset_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset TEXT NOT NULL CHECK (asset IN ('ETH','CRUDE','SPX','NDX')),
  prediction_date DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  direction TEXT NOT NULL CHECK (direction IN ('LONG','SHORT')),
  confidence NUMERIC(5,2) NOT NULL,
  entry_price NUMERIC(18,4) NOT NULL,
  stop_loss NUMERIC(18,4) NOT NULL,
  take_profit NUMERIC(18,4) NOT NULL,
  horizon_hours INTEGER NOT NULL DEFAULT 24,
  thesis TEXT NOT NULL,
  reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','WIN','LOSS','EXPIRED','CANCELLED')),
  settled_at TIMESTAMPTZ,
  settle_price NUMERIC(18,4),
  pnl_pct NUMERIC(8,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset, prediction_date)
);

GRANT SELECT ON public.asset_predictions TO anon;
GRANT SELECT ON public.asset_predictions TO authenticated;
GRANT ALL ON public.asset_predictions TO service_role;

ALTER TABLE public.asset_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_predictions public read"
  ON public.asset_predictions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX idx_asset_predictions_asset_date
  ON public.asset_predictions(asset, prediction_date DESC);