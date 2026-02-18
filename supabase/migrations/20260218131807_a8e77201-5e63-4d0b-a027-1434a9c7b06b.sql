-- Enable realtime for asha_alerts so monitoring panel gets live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.asha_alerts;

-- Enable pg_cron and pg_net for scheduled monitoring
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;