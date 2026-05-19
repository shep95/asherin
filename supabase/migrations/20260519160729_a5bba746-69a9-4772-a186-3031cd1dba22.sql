
CREATE TABLE IF NOT EXISTS public.user_key_material (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  salt_b64 TEXT NOT NULL,
  device_secret_b64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_key_material ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_key_material_self_select"
  ON public.user_key_material FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_key_material_self_insert"
  ON public.user_key_material FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_key_material_self_update"
  ON public.user_key_material FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
