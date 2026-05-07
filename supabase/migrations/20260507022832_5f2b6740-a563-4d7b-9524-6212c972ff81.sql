-- ZERLAL Team Members
CREATE TABLE public.zerlal_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin','analyst','viewer')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','suspended')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, email)
);

ALTER TABLE public.zerlal_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own team" ON public.zerlal_team_members
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_zerlal_team_updated
  BEFORE UPDATE ON public.zerlal_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ZERLAL Settings
CREATE TABLE public.zerlal_settings (
  user_id UUID PRIMARY KEY,
  scan_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (scan_frequency IN ('hourly','daily','weekly','manual')),
  severity_threshold TEXT NOT NULL DEFAULT 'medium' CHECK (severity_threshold IN ('low','medium','high','critical')),
  alert_email TEXT,
  slack_webhook TEXT,
  auto_remediation BOOLEAN NOT NULL DEFAULT false,
  retention_days INTEGER NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 7 AND 730),
  weekly_report BOOLEAN NOT NULL DEFAULT true,
  notify_critical BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zerlal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User manages own settings" ON public.zerlal_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_zerlal_settings_updated
  BEFORE UPDATE ON public.zerlal_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();