CREATE TABLE public.ghost_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  url text NOT NULL,
  host text NOT NULL,
  source_type text NOT NULL DEFAULT 'unknown',
  status integer,
  content_text text,
  content_bytes integer NOT NULL DEFAULT 0,
  content_sha256 text,
  storage_path text,
  truncated boolean NOT NULL DEFAULT false,
  language_tag text,
  entropy real,
  is_encrypted boolean NOT NULL DEFAULT false,
  emails text[] NOT NULL DEFAULT '{}',
  phones text[] NOT NULL DEFAULT '{}',
  ipv4s text[] NOT NULL DEFAULT '{}',
  filenames text[] NOT NULL DEFAULT '{}',
  urls text[] NOT NULL DEFAULT '{}',
  captured_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (user_id, session_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghost_sessions TO authenticated;
GRANT ALL ON public.ghost_sessions TO service_role;

ALTER TABLE public.ghost_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ghost_sessions owner read"   ON public.ghost_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ghost_sessions owner write"  ON public.ghost_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ghost_sessions owner update" ON public.ghost_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ghost_sessions owner delete" ON public.ghost_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX ghost_sessions_user_exp_idx ON public.ghost_sessions (user_id, expires_at DESC);
CREATE INDEX ghost_sessions_host_idx     ON public.ghost_sessions (user_id, host);

CREATE OR REPLACE FUNCTION public.ghost_buffer_purge()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE removed integer;
BEGIN
  DELETE FROM public.ghost_sessions WHERE expires_at < now();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ghost_buffer_purge() TO authenticated, service_role;