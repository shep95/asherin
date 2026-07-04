CREATE TABLE public.gematria_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phrase text NOT NULL,
  normalized text NOT NULL,
  ordinal integer NOT NULL,
  reduction integer NOT NULL,
  reverse_ordinal integer NOT NULL,
  chaldean integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, normalized)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gematria_entries TO authenticated;
GRANT ALL ON public.gematria_entries TO service_role;

ALTER TABLE public.gematria_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own gematria entries"
  ON public.gematria_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX gematria_entries_user_ordinal_idx ON public.gematria_entries (user_id, ordinal);
CREATE INDEX gematria_entries_user_reduction_idx ON public.gematria_entries (user_id, reduction);
CREATE INDEX gematria_entries_user_reverse_idx ON public.gematria_entries (user_id, reverse_ordinal);
CREATE INDEX gematria_entries_user_chaldean_idx ON public.gematria_entries (user_id, chaldean);