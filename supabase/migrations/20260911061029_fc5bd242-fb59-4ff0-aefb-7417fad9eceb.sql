ALTER TABLE public.software_artifact
  ADD COLUMN IF NOT EXISTS entrypoint text,
  ADD COLUMN IF NOT EXISTS runtime_type text NOT NULL DEFAULT 'client_browser',
  ADD COLUMN IF NOT EXISTS release_status text NOT NULL DEFAULT 'draft';

ALTER TABLE public.software_artifact
  ADD CONSTRAINT software_artifact_runtime_type_chk
  CHECK (runtime_type IN ('client_browser','isolated_server','full_build','native','unavailable'));

ALTER TABLE public.software_artifact
  ADD CONSTRAINT software_artifact_release_status_chk
  CHECK (release_status IN ('draft','preflight','installable','installed','published','blocked'));

ALTER TABLE public.software_artifact_version
  ADD COLUMN IF NOT EXISTS label text;

ALTER TABLE public.software_artifact_run
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'browser_sandbox',
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

CREATE TABLE IF NOT EXISTS public.software_artifact_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id uuid NOT NULL REFERENCES public.software_artifact(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  collection text NOT NULL,
  record_key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, owner_user_id, collection, record_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_artifact_data TO authenticated;
GRANT ALL ON public.software_artifact_data TO service_role;

ALTER TABLE public.software_artifact_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages artifact data"
  ON public.software_artifact_data FOR ALL
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS software_artifact_data_lookup
  ON public.software_artifact_data (artifact_id, owner_user_id, collection);

CREATE TRIGGER software_artifact_data_touch
  BEFORE UPDATE ON public.software_artifact_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();