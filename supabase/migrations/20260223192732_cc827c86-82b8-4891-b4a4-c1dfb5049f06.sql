
-- Add a settings row to control cron state
CREATE TABLE IF NOT EXISTS public.self_learning_cron_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  interval_minutes integer NOT NULL DEFAULT 60,
  last_cron_run_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.self_learning_cron_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (edge function uses service role)
CREATE POLICY "Service role only for cron settings"
ON public.self_learning_cron_settings
FOR ALL USING (false);

-- Insert default row
INSERT INTO public.self_learning_cron_settings (enabled, interval_minutes) VALUES (false, 60);
