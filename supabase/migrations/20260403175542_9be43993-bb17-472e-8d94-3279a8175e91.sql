
-- User sessions tracking
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token_hash text NOT NULL,
  device_type text DEFAULT 'unknown',
  browser text DEFAULT 'unknown',
  os text DEFAULT 'unknown',
  ip_address text,
  city text,
  region text,
  country text,
  is_current boolean DEFAULT false,
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.user_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.user_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert sessions"
  ON public.user_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.user_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_last_active ON public.user_sessions(last_active_at DESC);

-- Account activity log
CREATE TABLE public.account_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  description text NOT NULL,
  ip_address text,
  device_info text,
  location text,
  outcome text DEFAULT 'success',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.account_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity"
  ON public.account_activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity"
  ON public.account_activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_activity_log_user_id ON public.account_activity_log(user_id);
CREATE INDEX idx_activity_log_created ON public.account_activity_log(created_at DESC);
CREATE INDEX idx_activity_log_event_type ON public.account_activity_log(event_type);

-- Security notification preferences
CREATE TABLE public.security_notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  new_device_login boolean DEFAULT true,
  failed_login_attempts boolean DEFAULT true,
  password_change boolean DEFAULT true,
  mfa_change boolean DEFAULT true,
  session_revocation boolean DEFAULT true,
  recovery_code_usage boolean DEFAULT true,
  notify_email boolean DEFAULT true,
  notify_sms boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.security_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prefs"
  ON public.security_notification_prefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prefs"
  ON public.security_notification_prefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prefs"
  ON public.security_notification_prefs FOR UPDATE
  USING (auth.uid() = user_id);
