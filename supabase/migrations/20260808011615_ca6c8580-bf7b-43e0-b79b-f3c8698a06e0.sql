ALTER TABLE public.rideshare_settings
  ADD COLUMN IF NOT EXISTS autopilot_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lookback_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS last_scan_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_scan_status text,
  ADD COLUMN IF NOT EXISTS last_scan_detail text,
  ADD COLUMN IF NOT EXISTS next_due_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.rideshare_rides
  ADD COLUMN IF NOT EXISTS auto_captured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_message_id text,
  ADD COLUMN IF NOT EXISTS ride_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS rideshare_rides_email_msg_uidx
  ON public.rideshare_rides (user_id, email_message_id)
  WHERE email_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rideshare_settings_due_idx
  ON public.rideshare_settings (next_due_at)
  WHERE autopilot_enabled;

INSERT INTO public.cron_tokens (name, token)
VALUES ('rideshare_autopilot', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;