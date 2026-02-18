
-- Add session_id to asha_reports table
ALTER TABLE public.asha_reports ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.asha_sessions(id) ON DELETE CASCADE;

-- Ensure cascade delete on asha_datasets session_id FK
ALTER TABLE public.asha_datasets DROP CONSTRAINT IF EXISTS asha_datasets_session_id_fkey;
ALTER TABLE public.asha_datasets ADD CONSTRAINT asha_datasets_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.asha_sessions(id) ON DELETE CASCADE;

-- Ensure cascade delete on asha_documents session_id FK
ALTER TABLE public.asha_documents DROP CONSTRAINT IF EXISTS asha_documents_session_id_fkey;
ALTER TABLE public.asha_documents ADD CONSTRAINT asha_documents_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.asha_sessions(id) ON DELETE CASCADE;
