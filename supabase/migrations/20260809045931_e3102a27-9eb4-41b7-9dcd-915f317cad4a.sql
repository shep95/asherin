DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'google_accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.google_accounts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'google_intel_devices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.google_intel_devices;
  END IF;
END
$$;