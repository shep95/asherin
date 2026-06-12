CREATE TABLE IF NOT EXISTS public.asher_gate_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  failed_count INTEGER NOT NULL DEFAULT 0,
  first_failure_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_failure_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asher_gate_attempts_locked_until_idx
  ON public.asher_gate_attempts (locked_until);

GRANT ALL ON public.asher_gate_attempts TO service_role;

ALTER TABLE public.asher_gate_attempts ENABLE ROW LEVEL SECURITY;

-- No anon or authenticated policies — only service_role (edge function) touches this table.
CREATE POLICY "service role manages gate attempts"
  ON public.asher_gate_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);