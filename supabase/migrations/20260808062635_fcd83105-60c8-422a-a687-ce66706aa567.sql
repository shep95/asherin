CREATE TABLE public.google_meet_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.google_accounts(id) ON DELETE SET NULL,
  dedupe_key text NOT NULL,
  conference_code text,
  space_name text,
  title text,
  meet_link text,
  organizer_email text,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  source text NOT NULL DEFAULT 'calendar',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);

GRANT SELECT, UPDATE, DELETE ON public.google_meet_sessions TO authenticated;
GRANT ALL ON public.google_meet_sessions TO service_role;
ALTER TABLE public.google_meet_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meet sessions are owner only"
  ON public.google_meet_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_meet_sessions_user_time
  ON public.google_meet_sessions (user_id, started_at DESC NULLS LAST);

CREATE TABLE public.google_meet_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.google_meet_sessions(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.google_accounts(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'recording',
  drive_file_id text NOT NULL,
  name text,
  mime_type text,
  size_bytes bigint,
  duration_ms bigint,
  thumbnail_link text,
  web_view_link text,
  file_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, drive_file_id)
);

GRANT SELECT, UPDATE, DELETE ON public.google_meet_artifacts TO authenticated;
GRANT ALL ON public.google_meet_artifacts TO service_role;
ALTER TABLE public.google_meet_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meet artifacts are owner only"
  ON public.google_meet_artifacts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_meet_artifacts_session ON public.google_meet_artifacts (session_id);
CREATE INDEX idx_meet_artifacts_user_time ON public.google_meet_artifacts (user_id, file_created_at DESC NULLS LAST);

CREATE TRIGGER trg_meet_sessions_updated_at
  BEFORE UPDATE ON public.google_meet_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_meet_artifacts_updated_at
  BEFORE UPDATE ON public.google_meet_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();