-- 1. fixed search_path on the email queue helpers
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_temp;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_temp;

-- 2. trigger functions are never called directly by a client
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_intel_job_user_cap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_single_team_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_team_seat_cap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hoa_fanout_to_aureon() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.software_artifact_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.software_force_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.software_version_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_guard_display_name() FROM PUBLIC, anon, authenticated;

-- 3. scheduled / service-only routines
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ghost_buffer_purge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.organism_purge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_soft_deleted(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.site_traffic_run_brain() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fold_memory_tick() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eye_grid_absorb(jsonb, timestamp with time zone) FROM PUBLIC, anon, authenticated;

-- 4. no anonymous access to analytics or the email digest helper
REVOKE ALL ON FUNCTION public.analytics_live(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.analytics_overview(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_email_sha256(uuid) FROM PUBLIC, anon;

-- 5. internal tables: explicit "no client access" instead of silent lockout
REVOKE ALL ON TABLE public.cron_tokens FROM anon, authenticated;
REVOKE ALL ON TABLE public.hoa_aureon_training_feed FROM anon, authenticated;
REVOKE ALL ON TABLE public.download_counters FROM anon, authenticated;

CREATE POLICY "no client access" ON public.cron_tokens
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no client access" ON public.hoa_aureon_training_feed
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no client access" ON public.download_counters
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);