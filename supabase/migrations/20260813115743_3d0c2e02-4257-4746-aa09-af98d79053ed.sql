ALTER TABLE public.library_files
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS text_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS text_chars integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS folder text;

ALTER TABLE public.library_files
  DROP CONSTRAINT IF EXISTS library_files_text_status_chk;
ALTER TABLE public.library_files
  ADD CONSTRAINT library_files_text_status_chk
  CHECK (text_status IN ('pending','ok','empty','unsupported','failed'));

CREATE INDEX IF NOT EXISTS library_files_user_project_idx ON public.library_files (user_id, project_id);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'isolated';
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_mode_chk;
ALTER TABLE public.projects ADD CONSTRAINT projects_mode_chk CHECK (mode IN ('isolated','web'));

ALTER TABLE public.memory_entries
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.memory_entries DROP CONSTRAINT IF EXISTS memory_entries_kind_chk;
ALTER TABLE public.memory_entries ADD CONSTRAINT memory_entries_kind_chk
  CHECK (kind IN ('prefer','never','process','output','scope','general'));

CREATE INDEX IF NOT EXISTS memory_entries_user_project_idx ON public.memory_entries (user_id, project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_entries TO authenticated;
GRANT ALL ON public.library_files TO service_role;
GRANT ALL ON public.projects TO service_role;
GRANT ALL ON public.memory_entries TO service_role;