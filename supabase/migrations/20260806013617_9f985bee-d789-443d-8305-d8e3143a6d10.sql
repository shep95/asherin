CREATE TABLE public.google_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  account_id uuid REFERENCES public.google_accounts(id) ON DELETE CASCADE,
  account_email text,
  source text NOT NULL,
  kind text NOT NULL,
  external_id text NOT NULL,
  occurred_at timestamptz,
  actor_email text,
  actor_name text,
  direction text,
  subject text,
  snippet text,
  counterparties text[] NOT NULL DEFAULT '{}',
  people_text text NOT NULL DEFAULT '',
  amount numeric,
  currency text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint text NOT NULL,
  search tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(subject,'') || ' ' || coalesce(snippet,'') || ' ' ||
      coalesce(actor_name,'') || ' ' || coalesce(actor_email,'') || ' ' ||
      coalesce(people_text,''))
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_signals_user_fingerprint_key UNIQUE (user_id, fingerprint)
);

CREATE INDEX google_signals_user_time_idx ON public.google_signals (user_id, occurred_at DESC NULLS LAST);
CREATE INDEX google_signals_user_source_idx ON public.google_signals (user_id, source, occurred_at DESC NULLS LAST);
CREATE INDEX google_signals_actor_idx ON public.google_signals (user_id, actor_email);
CREATE INDEX google_signals_search_idx ON public.google_signals USING gin (search);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_signals TO authenticated;
GRANT ALL ON public.google_signals TO service_role;
ALTER TABLE public.google_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "google_signals_own" ON public.google_signals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.google_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  domain text NOT NULL,
  code text NOT NULL,
  subject_key text NOT NULL DEFAULT '',
  severity smallint NOT NULL DEFAULT 2,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  metric jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  dismissed boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_insights_unique_key UNIQUE (user_id, code, subject_key)
);

CREATE INDEX google_insights_user_idx ON public.google_insights (user_id, domain, severity DESC, computed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_insights TO authenticated;
GRANT ALL ON public.google_insights TO service_role;
ALTER TABLE public.google_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "google_insights_own" ON public.google_insights FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.google_sweeps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  account_id uuid REFERENCES public.google_accounts(id) ON DELETE CASCADE,
  source text NOT NULL,
  cursor text,
  last_run_at timestamptz,
  signals_ingested integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'idle',
  error text,
  CONSTRAINT google_sweeps_unique_key UNIQUE (user_id, account_id, source)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_sweeps TO authenticated;
GRANT ALL ON public.google_sweeps TO service_role;
ALTER TABLE public.google_sweeps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "google_sweeps_own" ON public.google_sweeps FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);