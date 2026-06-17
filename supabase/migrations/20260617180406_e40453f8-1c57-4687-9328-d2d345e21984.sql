CREATE TABLE public.zaxin_response_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  response jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zaxin_response_actions TO authenticated;
GRANT ALL ON public.zaxin_response_actions TO service_role;

ALTER TABLE public.zaxin_response_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own response actions"
  ON public.zaxin_response_actions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_zaxin_response_user_created ON public.zaxin_response_actions(user_id, created_at DESC);