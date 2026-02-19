
-- Security Events table (WAF, IDS, all detections)
CREATE TABLE public.security_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'waf_block',
  severity TEXT NOT NULL DEFAULT 'medium',
  source_ip TEXT,
  user_agent TEXT,
  request_path TEXT,
  request_method TEXT,
  payload_snippet TEXT,
  detection_rule TEXT NOT NULL,
  action_taken TEXT NOT NULL DEFAULT 'blocked',
  geo_country TEXT,
  geo_city TEXT,
  fingerprint TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (from edge functions)
CREATE POLICY "Service role inserts security events"
  ON public.security_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view security events"
  ON public.security_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Threat Intelligence (known malicious IPs, patterns)
CREATE TABLE public.threat_intelligence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  indicator_type TEXT NOT NULL DEFAULT 'ip',
  indicator_value TEXT NOT NULL,
  threat_category TEXT NOT NULL DEFAULT 'malicious',
  confidence INTEGER NOT NULL DEFAULT 80,
  source TEXT NOT NULL DEFAULT 'internal',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen TIMESTAMPTZ,
  hit_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.threat_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view threat intel"
  ON public.threat_intelligence FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage threat intel"
  ON public.threat_intelligence FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Honeypot Logs
CREATE TABLE public.honeypot_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trap_type TEXT NOT NULL DEFAULT 'endpoint',
  trap_name TEXT NOT NULL,
  source_ip TEXT,
  user_agent TEXT,
  request_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  fingerprint TEXT,
  geo_country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.honeypot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service inserts honeypot logs"
  ON public.honeypot_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view honeypot logs"
  ON public.honeypot_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Incident Response Actions
CREATE TABLE public.incident_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_type TEXT NOT NULL,
  target_user_id UUID,
  target_ip TEXT,
  action_taken TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high',
  auto_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service inserts incident responses"
  ON public.incident_responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view incidents"
  ON public.incident_responses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update incidents"
  ON public.incident_responses FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- User Behavior Analytics
CREATE TABLE public.user_behavior_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_fingerprint TEXT,
  behavior_type TEXT NOT NULL DEFAULT 'normal',
  risk_score INTEGER NOT NULL DEFAULT 0,
  anomaly_details TEXT,
  request_count INTEGER NOT NULL DEFAULT 0,
  unique_endpoints INTEGER NOT NULL DEFAULT 0,
  avg_response_time_ms INTEGER,
  geo_location TEXT,
  device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_end TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_behavior_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own behavior analytics"
  ON public.user_behavior_analytics FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service inserts behavior analytics"
  ON public.user_behavior_analytics FOR INSERT
  WITH CHECK (true);

-- Rate Limit Tracking
CREATE TABLE public.rate_limit_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL DEFAULT 'ip',
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_end TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 minute',
  blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manages rate limits"
  ON public.rate_limit_tracking FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_security_events_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_created ON public.security_events(created_at DESC);
CREATE INDEX idx_security_events_severity ON public.security_events(severity);
CREATE INDEX idx_security_events_ip ON public.security_events(source_ip);
CREATE INDEX idx_threat_intel_indicator ON public.threat_intelligence(indicator_value);
CREATE INDEX idx_threat_intel_type ON public.threat_intelligence(indicator_type);
CREATE INDEX idx_honeypot_created ON public.honeypot_logs(created_at DESC);
CREATE INDEX idx_incident_created ON public.incident_responses(created_at DESC);
CREATE INDEX idx_behavior_user ON public.user_behavior_analytics(user_id);
CREATE INDEX idx_rate_limit_identifier ON public.rate_limit_tracking(identifier, endpoint);

-- Seed threat intelligence with known malicious patterns
INSERT INTO public.threat_intelligence (indicator_type, indicator_value, threat_category, confidence, source) VALUES
  ('user_agent', 'sqlmap', 'scanner', 95, 'built-in'),
  ('user_agent', 'nikto', 'scanner', 95, 'built-in'),
  ('user_agent', 'burp', 'scanner', 90, 'built-in'),
  ('user_agent', 'metasploit', 'exploit_tool', 95, 'built-in'),
  ('user_agent', 'nmap', 'scanner', 85, 'built-in'),
  ('user_agent', 'dirbuster', 'scanner', 90, 'built-in'),
  ('user_agent', 'gobuster', 'scanner', 90, 'built-in'),
  ('user_agent', 'masscan', 'scanner', 85, 'built-in'),
  ('user_agent', 'hydra', 'brute_force', 95, 'built-in'),
  ('user_agent', 'wfuzz', 'fuzzer', 90, 'built-in'),
  ('pattern', '''OR 1=1', 'sql_injection', 99, 'built-in'),
  ('pattern', 'UNION SELECT', 'sql_injection', 99, 'built-in'),
  ('pattern', '<script>', 'xss', 99, 'built-in'),
  ('pattern', 'javascript:', 'xss', 95, 'built-in'),
  ('pattern', 'onerror=', 'xss', 95, 'built-in'),
  ('pattern', 'onload=', 'xss', 90, 'built-in'),
  ('pattern', '127.0.0.1', 'ssrf', 90, 'built-in'),
  ('pattern', 'localhost', 'ssrf', 85, 'built-in'),
  ('pattern', '169.254.169.254', 'ssrf', 99, 'built-in'),
  ('pattern', '0x7f000001', 'ssrf', 95, 'built-in'),
  ('geo_block', 'CN', 'geo_restricted', 70, 'policy'),
  ('geo_block', 'RU', 'geo_restricted', 70, 'policy'),
  ('geo_block', 'KP', 'geo_restricted', 95, 'policy');
