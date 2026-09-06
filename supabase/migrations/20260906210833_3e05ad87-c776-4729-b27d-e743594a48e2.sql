ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS instructions text NOT NULL DEFAULT '';
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_instructions_len_chk;
ALTER TABLE public.projects ADD CONSTRAINT projects_instructions_len_chk CHECK (char_length(instructions) <= 12000);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
CREATE INDEX IF NOT EXISTS conversations_project_id_idx ON public.conversations (user_id, project_id);