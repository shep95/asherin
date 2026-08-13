
CREATE TABLE IF NOT EXISTS public.google_mesh_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cache_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  accounts text[] NOT NULL DEFAULT '{}',
  built_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),
  UNIQUE (user_id, cache_key)
);
GRANT SELECT ON public.google_mesh_cache TO authenticated;
GRANT ALL ON public.google_mesh_cache TO service_role;
ALTER TABLE public.google_mesh_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mesh cache readable" ON public.google_mesh_cache
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.google_gmail_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  google_email text NOT NULL,
  history_id text,
  last_full_sync_at timestamptz,
  last_delta_at timestamptz,
  watch_expiration timestamptz,
  watch_topic text,
  watch_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_id)
);
GRANT SELECT ON public.google_gmail_sync TO authenticated;
GRANT ALL ON public.google_gmail_sync TO service_role;
ALTER TABLE public.google_gmail_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gmail sync readable" ON public.google_gmail_sync
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.google_sentinel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  google_email text,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  detail text,
  subject_email text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
GRANT SELECT, UPDATE ON public.google_sentinel_events TO authenticated;
GRANT ALL ON public.google_sentinel_events TO service_role;
ALTER TABLE public.google_sentinel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sentinel events readable" ON public.google_sentinel_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sentinel events ackable" ON public.google_sentinel_events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS google_sentinel_events_user_created_idx
  ON public.google_sentinel_events (user_id, created_at DESC);
