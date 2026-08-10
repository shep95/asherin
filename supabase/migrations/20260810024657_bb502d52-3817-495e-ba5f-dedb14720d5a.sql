CREATE TABLE public.artifact_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sha256 TEXT NOT NULL,
  sha1 TEXT,
  filename TEXT NOT NULL,
  filename_key TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'unknown',
  format TEXT,
  arch TEXT,
  signed TEXT NOT NULL DEFAULT 'unknown',
  build_time TIMESTAMPTZ,
  posture_score INTEGER,
  mitigations JSONB NOT NULL DEFAULT '{}'::jsonb,
  banned_symbols JSONB NOT NULL DEFAULT '[]'::jsonb,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  drift JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'ghost-engine',
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_count INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT artifact_ledger_user_sha_uniq UNIQUE (user_id, sha256)
);

CREATE INDEX artifact_ledger_user_name_idx ON public.artifact_ledger (user_id, filename_key, last_seen DESC);
CREATE INDEX artifact_ledger_user_seen_idx ON public.artifact_ledger (user_id, last_seen DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artifact_ledger TO authenticated;
GRANT ALL ON public.artifact_ledger TO service_role;

ALTER TABLE public.artifact_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own artifact ledger"
  ON public.artifact_ledger FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);