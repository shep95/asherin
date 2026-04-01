-- Trade history table
CREATE TABLE public.lavba_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  stop_loss NUMERIC,
  take_profit1 NUMERIC,
  take_profit2 NUMERIC,
  take_profit3 NUMERIC,
  position_size NUMERIC NOT NULL,
  size_usd NUMERIC NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 10,
  fees NUMERIC DEFAULT 0,
  realized_pnl NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'partial_tp', 'closed', 'stopped', 'cancelled')),
  signal_confidence NUMERIC,
  signal_reasoning TEXT,
  chart_review TEXT,
  based_on_patterns TEXT[],
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lavba_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage trades"
  ON public.lavba_trades FOR ALL
  USING (public.is_admin_user(auth.uid()));

-- Bot state table (single row per user)
CREATE TABLE public.lavba_bot_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT false,
  emergency_stopped BOOLEAN DEFAULT false,
  emergency_reason TEXT,
  current_coin TEXT DEFAULT 'BTC' CHECK (current_coin IN ('BTC', 'ETH')),
  last_trade_date DATE,
  daily_trade_count INTEGER DEFAULT 0,
  total_capital NUMERIC DEFAULT 0,
  available_capital NUMERIC DEFAULT 0,
  total_fees_paid NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lavba_bot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage bot state"
  ON public.lavba_bot_state FOR ALL
  USING (public.is_admin_user(auth.uid()));

-- PNL snapshots table
CREATE TABLE public.lavba_pnl_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('day', 'month', 'year')),
  period_date DATE NOT NULL,
  starting_balance NUMERIC DEFAULT 0,
  ending_balance NUMERIC DEFAULT 0,
  realized_pnl NUMERIC DEFAULT 0,
  fees_paid NUMERIC DEFAULT 0,
  trade_count INTEGER DEFAULT 0,
  win_count INTEGER DEFAULT 0,
  loss_count INTEGER DEFAULT 0,
  best_trade_pnl NUMERIC DEFAULT 0,
  worst_trade_pnl NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period_type, period_date)
);

ALTER TABLE public.lavba_pnl_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage pnl snapshots"
  ON public.lavba_pnl_snapshots FOR ALL
  USING (public.is_admin_user(auth.uid()));

-- Trigger for updated_at on bot_state
CREATE TRIGGER update_lavba_bot_state_updated_at
  BEFORE UPDATE ON public.lavba_bot_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_lavba_trades_user_status ON public.lavba_trades(user_id, status);
CREATE INDEX idx_lavba_trades_opened_at ON public.lavba_trades(opened_at DESC);
CREATE INDEX idx_lavba_pnl_user_period ON public.lavba_pnl_snapshots(user_id, period_type, period_date DESC);