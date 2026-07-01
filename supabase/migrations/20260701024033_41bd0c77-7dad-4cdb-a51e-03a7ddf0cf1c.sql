
CREATE TABLE IF NOT EXISTS public.zacoon_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  target_url TEXT,
  risk_envelope TEXT NOT NULL DEFAULT 'standard',
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  teg JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  intel JSONB NOT NULL DEFAULT '{}'::jsonb,
  integrity_cert TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zacoon_missions TO authenticated;
GRANT ALL ON public.zacoon_missions TO service_role;
ALTER TABLE public.zacoon_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY zacoon_missions_owner ON public.zacoon_missions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS zacoon_missions_user_created_idx
  ON public.zacoon_missions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.zacoon_cortex_events (
  id BIGSERIAL PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES public.zacoon_missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  data JSONB,
  ts_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.zacoon_cortex_events TO authenticated;
GRANT ALL ON public.zacoon_cortex_events TO service_role;
GRANT USAGE ON SEQUENCE public.zacoon_cortex_events_id_seq TO authenticated, service_role;
ALTER TABLE public.zacoon_cortex_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY zacoon_cortex_owner_read ON public.zacoon_cortex_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY zacoon_cortex_owner_insert ON public.zacoon_cortex_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS zacoon_cortex_mission_idx
  ON public.zacoon_cortex_events(mission_id, id);
