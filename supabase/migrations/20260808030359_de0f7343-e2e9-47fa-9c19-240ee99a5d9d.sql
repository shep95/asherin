ALTER TABLE public.security_notification_prefs
  ADD COLUMN IF NOT EXISTS notify_push boolean NOT NULL DEFAULT true;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS platform text;

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);