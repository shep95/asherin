CREATE TABLE public.asherin_ambient_pairings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  device_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ambient_pairings_user ON public.asherin_ambient_pairings(user_id, created_at DESC);
GRANT SELECT, DELETE ON public.asherin_ambient_pairings TO authenticated;
GRANT ALL ON public.asherin_ambient_pairings TO service_role;
ALTER TABLE public.asherin_ambient_pairings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pairings read" ON public.asherin_ambient_pairings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own pairings delete" ON public.asherin_ambient_pairings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.asherin_ambient_device_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_key TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'companion',
  platform TEXT NOT NULL DEFAULT 'desktop',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_key)
);
CREATE INDEX idx_ambient_device_tokens_user ON public.asherin_ambient_device_tokens(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.asherin_ambient_device_tokens TO authenticated;
GRANT ALL ON public.asherin_ambient_device_tokens TO service_role;
ALTER TABLE public.asherin_ambient_device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own device tokens read" ON public.asherin_ambient_device_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own device tokens revoke" ON public.asherin_ambient_device_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own device tokens delete" ON public.asherin_ambient_device_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);