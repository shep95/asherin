ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachments_enc TEXT;