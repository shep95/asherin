-- ═══════════════════════════════════════════════════════════════════════════
-- CLOUD INTELLIGENCE OP LAYER — account-scoped correlation ledger
-- Protection stops being per-device. Every device signed into the account is a
-- sensor; the account is the thing defended.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. ROSTER ─ every device knowingly enrolled as a sensor.
CREATE TABLE public.op_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  label text,
  platform text,
  app_version text,
  form_factor text NOT NULL DEFAULT 'unknown',
  fingerprint jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Tiered, explicit consent: identity (exists on roster) < read (may report
  -- signals) < comprehension (signals may be correlated and acted upon).
  consent_level text NOT NULL DEFAULT 'identity',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  last_report_at timestamptz,
  last_tier text,
  expected_interval_minutes integer NOT NULL DEFAULT 60,
  trusted boolean NOT NULL DEFAULT false,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_devices TO authenticated;
GRANT ALL ON public.op_devices TO service_role;
ALTER TABLE public.op_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_devices owner" ON public.op_devices FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. SIGNALS ─ append-only stream of local findings from every device.
CREATE TABLE public.op_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  signal_type text NOT NULL,
  verdict text NOT NULL DEFAULT 'unknown',
  confidence numeric NOT NULL DEFAULT 0.5,
  network_key text,
  lat double precision,
  lng double precision,
  accuracy double precision,
  runtime_tier text NOT NULL DEFAULT 'foreground',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.op_signals TO authenticated;
GRANT ALL ON public.op_signals TO service_role;
ALTER TABLE public.op_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_signals read own" ON public.op_signals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "op_signals insert own" ON public.op_signals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX op_signals_user_time_idx ON public.op_signals (user_id, observed_at DESC);
CREATE INDEX op_signals_user_net_idx ON public.op_signals (user_id, network_key);

-- 3. FINDINGS ─ correlated, account-level verdicts. Confidence is bounded by
--    how many independent devices and signal types corroborate it.
CREATE TABLE public.op_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  narrative text,
  severity text NOT NULL DEFAULT 'informational',
  confidence numeric NOT NULL DEFAULT 0.3,
  corroborating_devices integer NOT NULL DEFAULT 1,
  distinct_signal_types integer NOT NULL DEFAULT 1,
  response_tier text NOT NULL DEFAULT 'log',
  status text NOT NULL DEFAULT 'open',
  exposed_device_id text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
GRANT SELECT, UPDATE ON public.op_findings TO authenticated;
GRANT ALL ON public.op_findings TO service_role;
ALTER TABLE public.op_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_findings read own" ON public.op_findings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "op_findings update own" ON public.op_findings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX op_findings_user_status_idx ON public.op_findings (user_id, status, last_seen DESC);

-- 4. ACTIONS ─ append-only. A row is written BEFORE an automated action runs,
--    so "why did this happen" always has an answer.
CREATE TABLE public.op_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  finding_id uuid REFERENCES public.op_findings(id) ON DELETE SET NULL,
  device_id text,
  action text NOT NULL,
  rationale jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  outcome text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.op_actions TO authenticated;
GRANT ALL ON public.op_actions TO service_role;
ALTER TABLE public.op_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_actions read own" ON public.op_actions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX op_actions_user_time_idx ON public.op_actions (user_id, requested_at DESC);

-- 5. NETWORK POSTURE ─ what the account already knows about a network, so a
--    newly enrolled device inherits the posture instead of starting cold.
CREATE TABLE public.op_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  network_key text NOT NULL,
  label text,
  asn text,
  org text,
  country text,
  verdict text NOT NULL DEFAULT 'unknown',
  hostile_reports integer NOT NULL DEFAULT 0,
  clean_reports integer NOT NULL DEFAULT 0,
  devices_seen integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, network_key)
);
GRANT SELECT, UPDATE ON public.op_networks TO authenticated;
GRANT ALL ON public.op_networks TO service_role;
ALTER TABLE public.op_networks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_networks read own" ON public.op_networks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "op_networks update own" ON public.op_networks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. SERVER CLOCK ─ tier-3 scheduling state, one row per account.
CREATE TABLE public.op_cron_state (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  interval_minutes integer NOT NULL DEFAULT 15,
  next_due_at timestamptz NOT NULL DEFAULT now(),
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_status text,
  failures integer NOT NULL DEFAULT 0,
  auto_response_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.op_cron_state TO authenticated;
GRANT ALL ON public.op_cron_state TO service_role;
ALTER TABLE public.op_cron_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_cron_state read own" ON public.op_cron_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "op_cron_state update own" ON public.op_cron_state FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER op_devices_updated_at BEFORE UPDATE ON public.op_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER op_findings_updated_at BEFORE UPDATE ON public.op_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();