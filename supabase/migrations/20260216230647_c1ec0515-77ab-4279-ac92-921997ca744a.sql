
-- Monitoring rules table
CREATE TABLE public.asha_monitor_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  target TEXT NOT NULL,
  condition TEXT NOT NULL,
  threshold TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'Daily',
  active BOOLEAN NOT NULL DEFAULT true,
  last_checked TIMESTAMPTZ,
  last_triggered TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_monitor_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own monitor rules"
  ON public.asha_monitor_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own monitor rules"
  ON public.asha_monitor_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monitor rules"
  ON public.asha_monitor_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monitor rules"
  ON public.asha_monitor_rules FOR DELETE USING (auth.uid() = user_id);

-- Alerts table
CREATE TABLE public.asha_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_id UUID REFERENCES public.asha_monitor_rules(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON public.asha_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own alerts"
  ON public.asha_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts"
  ON public.asha_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alerts"
  ON public.asha_alerts FOR DELETE USING (auth.uid() = user_id);

-- Entity resolutions table (stores matched/merged entities)
CREATE TABLE public.asha_entity_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'unknown',
  entity_a JSONB NOT NULL,
  entity_b JSONB NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 0,
  match_fields TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_entity_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entity matches"
  ON public.asha_entity_matches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own entity matches"
  ON public.asha_entity_matches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own entity matches"
  ON public.asha_entity_matches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own entity matches"
  ON public.asha_entity_matches FOR DELETE USING (auth.uid() = user_id);
