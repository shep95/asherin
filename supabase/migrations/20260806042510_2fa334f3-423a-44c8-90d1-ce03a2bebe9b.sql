CREATE TABLE public.google_sync_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  interval_minutes integer NOT NULL DEFAULT 30,
  last_started_at timestamptz,
  last_synced_at timestamptz,
  next_due_at timestamptz NOT NULL DEFAULT now(),
  last_status text NOT NULL DEFAULT 'idle',
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  signals_ingested integer NOT NULL DEFAULT 0,
  insights_derived integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.google_sync_state TO authenticated;
GRANT ALL ON public.google_sync_state TO service_role;

ALTER TABLE public.google_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_sync_state_own_read" ON public.google_sync_state
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "google_sync_state_own_update" ON public.google_sync_state
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX google_sync_state_due_idx
  ON public.google_sync_state (next_due_at) WHERE enabled;

-- Time-dependent bounds belong in a trigger, not an immutable CHECK.
CREATE OR REPLACE FUNCTION public.google_sync_state_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.interval_minutes IS NULL OR NEW.interval_minutes < 15 THEN
    NEW.interval_minutes := 15;
  ELSIF NEW.interval_minutes > 1440 THEN
    NEW.interval_minutes := 1440;
  END IF;
  IF NEW.consecutive_failures < 0 THEN
    NEW.consecutive_failures := 0;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER google_sync_state_guard_trg
  BEFORE INSERT OR UPDATE ON public.google_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.google_sync_state_guard();