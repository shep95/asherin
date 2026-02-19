
-- Fix overly permissive RLS on rate_limit_tracking (only service role should manage)
DROP POLICY "Service manages rate limits" ON public.rate_limit_tracking;
CREATE POLICY "Service inserts rate limits" ON public.rate_limit_tracking FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated view rate limits" ON public.rate_limit_tracking FOR SELECT USING (auth.uid() IS NOT NULL);

-- Fix threat_intelligence to be more restrictive on writes
DROP POLICY "Authenticated users can manage threat intel" ON public.threat_intelligence;
CREATE POLICY "Authenticated users can insert threat intel" ON public.threat_intelligence FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update threat intel" ON public.threat_intelligence FOR UPDATE USING (auth.uid() IS NOT NULL);
