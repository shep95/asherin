-- HISTORY REDACTION: operator mailboxes that once appeared in this file have been
-- replaced with role labels. These statements already ran; identity is now decided
-- by public.is_internal_staff/is_internal_operator (sha256 digests). Do not
-- re-add an address here — a committed mailbox is a disclosure.

-- ASHER BRAINS: admin-only personality + knowledge files for Asher AI
CREATE TYPE public.asher_brain_category AS ENUM ('general', 'map', 'coding', 'personality', 'azplen', 'zali');

CREATE TABLE public.asher_brains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category public.asher_brain_category NOT NULL DEFAULT 'general',
  content TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  file_path TEXT,
  file_size INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asher_brains_category_active ON public.asher_brains (category, is_active);

ALTER TABLE public.asher_brains ENABLE ROW LEVEL SECURITY;

-- Only the super owner (operator-owner@redacted.invalid) can read/write
CREATE POLICY "Asher super owner can select brains"
  ON public.asher_brains FOR SELECT
  USING (public.is_asher_super_owner(auth.uid()));

CREATE POLICY "Asher super owner can insert brains"
  ON public.asher_brains FOR INSERT
  WITH CHECK (public.is_asher_super_owner(auth.uid()));

CREATE POLICY "Asher super owner can update brains"
  ON public.asher_brains FOR UPDATE
  USING (public.is_asher_super_owner(auth.uid()));

CREATE POLICY "Asher super owner can delete brains"
  ON public.asher_brains FOR DELETE
  USING (public.is_asher_super_owner(auth.uid()));

CREATE TRIGGER trg_asher_brains_updated
  BEFORE UPDATE ON public.asher_brains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for raw uploaded brain files
INSERT INTO storage.buckets (id, name, public)
  VALUES ('asher-brains', 'asher-brains', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Asher super owner reads brain files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'asher-brains' AND public.is_asher_super_owner(auth.uid()));

CREATE POLICY "Asher super owner uploads brain files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'asher-brains' AND public.is_asher_super_owner(auth.uid()));

CREATE POLICY "Asher super owner updates brain files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'asher-brains' AND public.is_asher_super_owner(auth.uid()));

CREATE POLICY "Asher super owner deletes brain files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'asher-brains' AND public.is_asher_super_owner(auth.uid()));
