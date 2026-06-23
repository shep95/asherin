
CREATE TABLE public.btc_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_date DATE NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  direction TEXT NOT NULL CHECK (direction IN ('LONG','SHORT')),
  confidence NUMERIC(5,2) NOT NULL,
  entry_price NUMERIC(18,2) NOT NULL,
  stop_loss NUMERIC(18,2) NOT NULL,
  take_profit NUMERIC(18,2) NOT NULL,
  horizon_hours INTEGER NOT NULL DEFAULT 24,
  thesis TEXT NOT NULL,
  reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','WIN','LOSS','EXPIRED')),
  settled_at TIMESTAMPTZ,
  settle_price NUMERIC(18,2),
  pnl_pct NUMERIC(8,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.btc_predictions TO anon;
GRANT SELECT ON public.btc_predictions TO authenticated;
GRANT ALL ON public.btc_predictions TO service_role;

ALTER TABLE public.btc_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "btc_predictions public read"
  ON public.btc_predictions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX idx_btc_predictions_date ON public.btc_predictions(prediction_date DESC);
