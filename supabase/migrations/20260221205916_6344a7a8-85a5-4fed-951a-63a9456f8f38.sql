
-- Table to store Google OAuth tokens for each linked account
CREATE TABLE public.google_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  google_email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  data_points_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'connected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, google_email)
);

ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own google accounts"
  ON public.google_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own google accounts"
  ON public.google_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own google accounts"
  ON public.google_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own google accounts"
  ON public.google_accounts FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_google_accounts_updated_at
  BEFORE UPDATE ON public.google_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
