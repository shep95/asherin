-- Aziion bot state
CREATE TABLE public.aziion_bot_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_prediction_at TIMESTAMPTZ,
  next_prediction_at TIMESTAMPTZ,
  total_trades INTEGER NOT NULL DEFAULT 0,
  successful_trades INTEGER NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  current_position_id UUID,
  emergency_stopped BOOLEAN NOT NULL DEFAULT false,
  emergency_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aziion_bot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only aziion_bot_state select" ON public.aziion_bot_state FOR SELECT USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin only aziion_bot_state insert" ON public.aziion_bot_state FOR INSERT WITH CHECK (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin only aziion_bot_state update" ON public.aziion_bot_state FOR UPDATE USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin only aziion_bot_state delete" ON public.aziion_bot_state FOR DELETE USING (public.is_admin_user(auth.uid()));

CREATE TRIGGER update_aziion_bot_state_updated_at BEFORE UPDATE ON public.aziion_bot_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Aziion prediction sessions
CREATE TABLE public.aziion_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Brent Oil Prediction',
  prediction_type TEXT NOT NULL DEFAULT 'brent_oil',
  status TEXT NOT NULL DEFAULT 'pending',
  ai_prediction TEXT,
  predicted_direction TEXT,
  predicted_entry NUMERIC,
  predicted_tp NUMERIC,
  predicted_sl NUMERIC,
  confidence_score NUMERIC,
  trade_placed BOOLEAN NOT NULL DEFAULT false,
  trade_id UUID,
  raw_intelligence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aziion_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only aziion_sessions select" ON public.aziion_sessions FOR SELECT USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin only aziion_sessions insert" ON public.aziion_sessions FOR INSERT WITH CHECK (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin only aziion_sessions update" ON public.aziion_sessions FOR UPDATE USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin only aziion_sessions delete" ON public.aziion_sessions FOR DELETE USING (public.is_admin_user(auth.uid()));

CREATE TRIGGER update_aziion_sessions_updated_at BEFORE UPDATE ON public.aziion_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Aziion trades
CREATE TABLE public.aziion_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.aziion_sessions(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL DEFAULT 'OIL',
  direction TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  take_profit NUMERIC,
  stop_loss NUMERIC,
  position_size NUMERIC,
  size_usd NUMERIC,
  leverage INTEGER NOT NULL DEFAULT 10,
  fees NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  pnl NUMERIC,
  signal_confidence NUMERIC,
  signal_reasoning TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aziion_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only aziion_trades select" ON public.aziion_trades FOR SELECT USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin only aziion_trades insert" ON public.aziion_trades FOR INSERT WITH CHECK (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin only aziion_trades update" ON public.aziion_trades FOR UPDATE USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin only aziion_trades delete" ON public.aziion_trades FOR DELETE USING (public.is_admin_user(auth.uid()));

CREATE TRIGGER update_aziion_trades_updated_at BEFORE UPDATE ON public.aziion_trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();