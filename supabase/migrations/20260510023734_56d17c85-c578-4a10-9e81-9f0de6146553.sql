
CREATE TABLE public.ava_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_time TIMESTAMPTZ NOT NULL,
  predicted_winner TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'MEDIUM',
  reasoning TEXT NOT NULL,
  sharp_angle TEXT,
  odds_analysis JSONB DEFAULT '{}'::jsonb,
  popularity_score INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  actual_winner TEXT,
  final_score TEXT,
  pick_date DATE NOT NULL DEFAULT CURRENT_DATE,
  picked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ava_picks_picked_at ON public.ava_picks(picked_at DESC);
CREATE INDEX idx_ava_picks_status ON public.ava_picks(status);
CREATE UNIQUE INDEX idx_ava_picks_game_day ON public.ava_picks(game_id, pick_date);

ALTER TABLE public.ava_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AVA picks are publicly viewable"
ON public.ava_picks FOR SELECT USING (true);

CREATE TABLE public.ava_win_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_picks INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ava_win_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AVA stats are publicly viewable"
ON public.ava_win_stats FOR SELECT USING (true);

INSERT INTO public.ava_win_stats (total_picks, wins, losses, pending, win_rate)
VALUES (0, 0, 0, 0, 0);

CREATE OR REPLACE FUNCTION public.touch_ava_picks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER ava_picks_set_updated
BEFORE UPDATE ON public.ava_picks
FOR EACH ROW EXECUTE FUNCTION public.touch_ava_picks_updated_at();
