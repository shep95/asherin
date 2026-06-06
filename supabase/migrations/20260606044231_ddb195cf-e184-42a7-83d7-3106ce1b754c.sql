
CREATE TABLE IF NOT EXISTS public.algorithm_chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL CHECK (scope IN ('anon','user')),
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_end TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.algorithm_chat_usage TO service_role;

ALTER TABLE public.algorithm_chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_algorithm_usage"
  ON public.algorithm_chat_usage FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_algorithm_chat_usage_window_end ON public.algorithm_chat_usage(window_end);
