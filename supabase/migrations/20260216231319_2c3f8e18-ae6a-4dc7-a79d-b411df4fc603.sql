
-- ASHA sessions table
CREATE TABLE public.asha_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '📊',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own asha_sessions"
  ON public.asha_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add session_id to asha_datasets so data is scoped per session
ALTER TABLE public.asha_datasets ADD COLUMN session_id UUID REFERENCES public.asha_sessions(id) ON DELETE CASCADE;
