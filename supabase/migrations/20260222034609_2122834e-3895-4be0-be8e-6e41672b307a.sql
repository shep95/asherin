
-- Table for storing per-user GitHub repo connections
CREATE TABLE public.github_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  github_token TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own GitHub connections"
ON public.github_connections FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own GitHub connections"
ON public.github_connections FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own GitHub connections"
ON public.github_connections FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own GitHub connections"
ON public.github_connections FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_github_connections_updated_at
BEFORE UPDATE ON public.github_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
