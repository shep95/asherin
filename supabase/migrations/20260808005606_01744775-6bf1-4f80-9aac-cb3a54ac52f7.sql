CREATE TABLE public.intel_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  subject_name text,
  source text,
  url text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  channels_delivered text[] NOT NULL DEFAULT '{}',
  idempotency_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX intel_notifications_idem_uidx
  ON public.intel_notifications (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX intel_notifications_user_created_idx
  ON public.intel_notifications (user_id, created_at DESC);
CREATE INDEX intel_notifications_unread_idx
  ON public.intel_notifications (user_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE, DELETE ON public.intel_notifications TO authenticated;
GRANT ALL ON public.intel_notifications TO service_role;
ALTER TABLE public.intel_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications readable" ON public.intel_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications updatable" ON public.intel_notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notifications deletable" ON public.intel_notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.intel_notification_prefs (
  user_id uuid PRIMARY KEY,
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  min_severity text NOT NULL DEFAULT 'info',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.intel_notification_prefs TO authenticated;
GRANT ALL ON public.intel_notification_prefs TO service_role;
ALTER TABLE public.intel_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notification prefs" ON public.intel_notification_prefs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.intel_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.intel_notifications;