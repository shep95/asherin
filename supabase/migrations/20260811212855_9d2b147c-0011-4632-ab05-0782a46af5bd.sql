-- 1. Service-role-only tables: stop them being world readable/writable via the anon key.
DROP POLICY IF EXISTS "service_role_only_algorithm_usage" ON public.algorithm_chat_usage;
CREATE POLICY "service_role_only_algorithm_usage" ON public.algorithm_chat_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "gate_attempts_service_role_all" ON public.asher_gate_attempts;
CREATE POLICY "gate_attempts_service_role_all" ON public.asher_gate_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages incidents" ON public.incident_responses;
CREATE POLICY "Service role manages incidents" ON public.incident_responses FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages installed plugins" ON public.installed_plugins;
CREATE POLICY "Service role manages installed plugins" ON public.installed_plugins FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages trial usage" ON public.pro_trial_usage;
CREATE POLICY "Service role manages trial usage" ON public.pro_trial_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages rate limits" ON public.rate_limit_tracking;
CREATE POLICY "Service role manages rate limits" ON public.rate_limit_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. "Signed-in" reads must actually require a session.
DROP POLICY IF EXISTS "Authenticated users can view active axrlen brains" ON public.axrlen_brains;
CREATE POLICY "Authenticated users can view active axrlen brains" ON public.axrlen_brains FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Signed-in operators can read the social bank" ON public.social_intel_cache;
CREATE POLICY "Signed-in operators can read the social bank" ON public.social_intel_cache FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Signed-in operators can read probe cooldowns" ON public.social_probe_cooldown;
CREATE POLICY "Signed-in operators can read probe cooldowns" ON public.social_probe_cooldown FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "read area risk" ON public.geo_risk_assessments;
CREATE POLICY "read area risk" ON public.geo_risk_assessments FOR SELECT TO authenticated USING (true);

-- 3. Revoke every leftover anon privilege on tables anon can never legitimately pass.
--    A table is kept anon-readable only when it still holds a permissive policy for
--    role public/anon whose USING clause does not depend on auth.uid()/auth.jwt().
DO $$
DECLARE
  r record;
  keep text[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT p.tablename), '{}')
    INTO keep
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.permissive = 'PERMISSIVE'
    AND p.cmd IN ('SELECT', 'ALL')
    AND (p.roles::text LIKE '%public%' OR p.roles::text LIKE '%anon%')
    AND p.qual IS NOT NULL
    AND p.qual <> 'false'
    AND p.qual NOT ILIKE '%auth.uid()%'
    AND p.qual NOT ILIKE '%auth.jwt()%'
    AND p.qual NOT ILIKE '%auth.role()%';

  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT (c.relname = ANY (keep))
      AND has_table_privilege('anon', c.oid, 'SELECT')
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.relname);
  END LOOP;
END $$;

-- 4. Stop future tables from silently handing privileges to anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;