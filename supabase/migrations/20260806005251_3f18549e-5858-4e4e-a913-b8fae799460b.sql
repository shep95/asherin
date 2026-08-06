CREATE TABLE public.mesh_dossiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_key TEXT NOT NULL,
  subject_email TEXT,
  subject_name TEXT NOT NULL,
  hop SMALLINT NOT NULL DEFAULT 1 CHECK (hop BETWEEN 1 AND 3),
  via TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','building','ready','failed','linked','skipped')),
  relationship JSONB NOT NULL DEFAULT '{}'::jsonb,
  dossier JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  priority NUMERIC NOT NULL DEFAULT 0,
  source_account TEXT,
  error_message TEXT,
  built_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_key)
);

CREATE INDEX idx_mesh_dossiers_user_status ON public.mesh_dossiers (user_id, status, priority DESC);
CREATE INDEX idx_mesh_dossiers_user_hop ON public.mesh_dossiers (user_id, hop, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesh_dossiers TO authenticated;
GRANT ALL ON public.mesh_dossiers TO service_role;
ALTER TABLE public.mesh_dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their own dossiers"
  ON public.mesh_dossiers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.mesh_dossier_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  queued INTEGER NOT NULL DEFAULT 0,
  built INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_mesh_dossier_runs_user ON public.mesh_dossier_runs (user_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesh_dossier_runs TO authenticated;
GRANT ALL ON public.mesh_dossier_runs TO service_role;
ALTER TABLE public.mesh_dossier_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their own vault runs"
  ON public.mesh_dossier_runs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER mesh_dossiers_touch
  BEFORE UPDATE ON public.mesh_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();