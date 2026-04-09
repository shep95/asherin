
-- CRITICAL FIX 1: user_subscriptions
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admin manages subscriptions"
  ON public.user_subscriptions FOR ALL
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- CRITICAL FIX 2: user_behavior_analytics
DROP POLICY IF EXISTS "Users can view own behavior analytics" ON public.user_behavior_analytics;
DROP POLICY IF EXISTS "Service inserts behavior analytics" ON public.user_behavior_analytics;
CREATE POLICY "Users view own behavior analytics"
  ON public.user_behavior_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admin inserts behavior analytics"
  ON public.user_behavior_analytics FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));

-- CRITICAL FIX 3: incident_responses
DROP POLICY IF EXISTS "Authenticated users can view incidents" ON public.incident_responses;
DROP POLICY IF EXISTS "Authenticated users can update incidents" ON public.incident_responses;
DROP POLICY IF EXISTS "Service inserts incident responses" ON public.incident_responses;
CREATE POLICY "Admin manages incidents"
  ON public.incident_responses FOR ALL
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- CRITICAL FIX 4: self_learning_runs
DROP POLICY IF EXISTS "Admin full access on runs" ON public.self_learning_runs;
CREATE POLICY "Admin only access on runs"
  ON public.self_learning_runs FOR ALL
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- CRITICAL FIX 5: self_learning_agent_logs
DROP POLICY IF EXISTS "Admin full access on agent_logs" ON public.self_learning_agent_logs;
CREATE POLICY "Admin only access on agent_logs"
  ON public.self_learning_agent_logs FOR ALL
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- CRITICAL FIX 6: self_learning_brains
DROP POLICY IF EXISTS "Admin full access on brains" ON public.self_learning_brains;
CREATE POLICY "Admin only access on brains"
  ON public.self_learning_brains FOR ALL
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- CRITICAL FIX 7: security_events
DROP POLICY IF EXISTS "Authenticated users can view security events" ON public.security_events;
DROP POLICY IF EXISTS "Service role inserts security events" ON public.security_events;
CREATE POLICY "Admin views security events"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin inserts security events"
  ON public.security_events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));

-- CRITICAL FIX 8: honeypot_logs
DROP POLICY IF EXISTS "Authenticated users can view honeypot logs" ON public.honeypot_logs;
DROP POLICY IF EXISTS "Service inserts honeypot logs" ON public.honeypot_logs;
CREATE POLICY "Admin views honeypot logs"
  ON public.honeypot_logs FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin inserts honeypot logs"
  ON public.honeypot_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));

-- WARNING FIX 9: threat_intelligence
DROP POLICY IF EXISTS "Authenticated users can insert threat intel" ON public.threat_intelligence;
DROP POLICY IF EXISTS "Authenticated users can update threat intel" ON public.threat_intelligence;
CREATE POLICY "Admin inserts threat intel"
  ON public.threat_intelligence FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin updates threat intel"
  ON public.threat_intelligence FOR UPDATE
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- WARNING FIX 10: rate_limit_tracking
DROP POLICY IF EXISTS "Authenticated view rate limits" ON public.rate_limit_tracking;
DROP POLICY IF EXISTS "Service inserts rate limits" ON public.rate_limit_tracking;
CREATE POLICY "Admin views rate limits"
  ON public.rate_limit_tracking FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admin inserts rate limits"
  ON public.rate_limit_tracking FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));

-- WARNING FIX 11: prediction_history (no user_id — shared table)
DROP POLICY IF EXISTS "All users can read history" ON public.prediction_history;
DROP POLICY IF EXISTS "Authenticated users can insert history" ON public.prediction_history;
CREATE POLICY "Authenticated users read prediction history"
  ON public.prediction_history FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin inserts prediction history"
  ON public.prediction_history FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));
