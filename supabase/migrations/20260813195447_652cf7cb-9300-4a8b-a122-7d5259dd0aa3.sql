ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS dashboard_bg_mode text NOT NULL DEFAULT 'wallpaper',
  ADD COLUMN IF NOT EXISTS dashboard_bg_color text;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_dashboard_bg_mode_check
  CHECK (dashboard_bg_mode IN ('wallpaper', 'color'));

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_dashboard_bg_color_check
  CHECK (dashboard_bg_color IS NULL OR dashboard_bg_color ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$');