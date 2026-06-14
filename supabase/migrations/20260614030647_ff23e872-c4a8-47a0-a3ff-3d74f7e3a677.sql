-- 1. Security infra: service-role-only writes
DROP POLICY IF EXISTS "Users can insert security events" ON public.security_events;
DROP POLICY IF EXISTS "Anyone can insert security events" ON public.security_events;
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;
DROP POLICY IF EXISTS "Service inserts security events" ON public.security_events;
DROP POLICY IF EXISTS "Service role inserts security events" ON public.security_events;
CREATE POLICY "Service role inserts security events"
  ON public.security_events FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Users can insert honeypot logs" ON public.honeypot_logs;
DROP POLICY IF EXISTS "Anyone can insert honeypot logs" ON public.honeypot_logs;
DROP POLICY IF EXISTS "System can insert honeypot logs" ON public.honeypot_logs;
DROP POLICY IF EXISTS "Service inserts honeypot logs" ON public.honeypot_logs;
DROP POLICY IF EXISTS "Service role inserts honeypot logs" ON public.honeypot_logs;
CREATE POLICY "Service role inserts honeypot logs"
  ON public.honeypot_logs FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Users can insert incidents" ON public.incident_responses;
DROP POLICY IF EXISTS "Users update incidents" ON public.incident_responses;
DROP POLICY IF EXISTS "Anyone can insert incidents" ON public.incident_responses;
DROP POLICY IF EXISTS "Authenticated users can manage incidents" ON public.incident_responses;
DROP POLICY IF EXISTS "Service role manages incidents" ON public.incident_responses;
CREATE POLICY "Service role manages incidents"
  ON public.incident_responses FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone manages rate limits" ON public.rate_limit_tracking;
DROP POLICY IF EXISTS "Users can manage rate limits" ON public.rate_limit_tracking;
DROP POLICY IF EXISTS "System manages rate limits" ON public.rate_limit_tracking;
DROP POLICY IF EXISTS "Service manages rate limits" ON public.rate_limit_tracking;
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.rate_limit_tracking;
CREATE POLICY "Service role manages rate limits"
  ON public.rate_limit_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. user_behavior_analytics — per-user SELECT, admin sees all
DROP POLICY IF EXISTS "Users can view own behavior analytics" ON public.user_behavior_analytics;
DROP POLICY IF EXISTS "Users view behavior analytics" ON public.user_behavior_analytics;
DROP POLICY IF EXISTS "Authenticated users view behavior" ON public.user_behavior_analytics;
DROP POLICY IF EXISTS "Users view own behavior analytics" ON public.user_behavior_analytics;
DROP POLICY IF EXISTS "Admins view all behavior analytics" ON public.user_behavior_analytics;
CREATE POLICY "Users view own behavior analytics"
  ON public.user_behavior_analytics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all behavior analytics"
  ON public.user_behavior_analytics FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

-- 3. houseofasher_applications — require auth
REVOKE INSERT ON public.houseofasher_applications FROM anon;
DROP POLICY IF EXISTS "Anyone can submit application" ON public.houseofasher_applications;
DROP POLICY IF EXISTS "Public can submit application" ON public.houseofasher_applications;
DROP POLICY IF EXISTS "Anonymous can submit application" ON public.houseofasher_applications;
DROP POLICY IF EXISTS "Authenticated can submit application" ON public.houseofasher_applications;
CREATE POLICY "Authenticated can submit application"
  ON public.houseofasher_applications FOR INSERT TO authenticated WITH CHECK (true);

-- 4. installed_plugins — block client INSERT; service role only writes
DROP POLICY IF EXISTS "Users can manage own installed plugins" ON public.installed_plugins;
DROP POLICY IF EXISTS "Users manage own installed plugins" ON public.installed_plugins;
DROP POLICY IF EXISTS "Users read own installed plugins" ON public.installed_plugins;
DROP POLICY IF EXISTS "Users delete own installed plugins" ON public.installed_plugins;
DROP POLICY IF EXISTS "Service role manages installed plugins" ON public.installed_plugins;
CREATE POLICY "Users read own installed plugins"
  ON public.installed_plugins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own installed plugins"
  ON public.installed_plugins FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages installed plugins"
  ON public.installed_plugins FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. user_subscriptions idempotency
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS stripe_session_id text;
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_stripe_session_id_uq
  ON public.user_subscriptions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- 6. Pro trial usage tracking
CREATE TABLE IF NOT EXISTS public.pro_trial_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pro_trial_usage TO authenticated;
GRANT ALL ON public.pro_trial_usage TO service_role;
ALTER TABLE public.pro_trial_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own trial usage" ON public.pro_trial_usage;
CREATE POLICY "Users view own trial usage"
  ON public.pro_trial_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role manages trial usage" ON public.pro_trial_usage;
CREATE POLICY "Service role manages trial usage"
  ON public.pro_trial_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. Drop legacy open SELECT policies on privatized buckets
DROP POLICY IF EXISTS "Public read vibe videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view vibe videos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view vibe videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view vibe images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view vibe images" ON storage.objects;
DROP POLICY IF EXISTS "Vibe images public read" ON storage.objects;
DROP POLICY IF EXISTS "Public can view custom wallpapers" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view custom wallpapers" ON storage.objects;
DROP POLICY IF EXISTS "Custom wallpapers public read" ON storage.objects;