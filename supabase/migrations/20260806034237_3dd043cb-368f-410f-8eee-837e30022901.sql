ALTER TABLE public.mesh_dossiers ADD COLUMN IF NOT EXISTS channel TEXT;
CREATE INDEX IF NOT EXISTS idx_mesh_dossiers_user_channel ON public.mesh_dossiers (user_id, channel, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.mesh_vault_settings (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sentinel_enabled BOOLEAN NOT NULL DEFAULT true,
  last_watermark TIMESTAMP WITH TIME ZONE,
  last_sweep_at TIMESTAMP WITH TIME ZONE,
  channels JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesh_vault_settings TO authenticated;
GRANT ALL ON public.mesh_vault_settings TO service_role;
ALTER TABLE public.mesh_vault_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their own vault settings"
  ON public.mesh_vault_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER mesh_vault_settings_touch
  BEFORE UPDATE ON public.mesh_vault_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();