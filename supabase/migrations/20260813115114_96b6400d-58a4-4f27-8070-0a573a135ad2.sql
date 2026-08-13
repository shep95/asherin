CREATE TABLE public.vault_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('login','note','card','totp','token')),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  domain text CHECK (domain IS NULL OR char_length(domain) <= 253),
  payload_cipher text NOT NULL CHECK (char_length(payload_cipher) <= 60000),
  breach_status text NOT NULL DEFAULT 'unchecked' CHECK (breach_status IN ('unchecked','clear','exposed','error')),
  breach_count integer NOT NULL DEFAULT 0 CHECK (breach_count >= 0),
  breach_checked_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_items TO authenticated;
GRANT ALL ON public.vault_items TO service_role;

ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their vault items"
  ON public.vault_items FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners create their vault items"
  ON public.vault_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners update their vault items"
  ON public.vault_items FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners delete their vault items"
  ON public.vault_items FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX vault_items_user_updated_idx ON public.vault_items (user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_vault_items_updated_at
  BEFORE UPDATE ON public.vault_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();