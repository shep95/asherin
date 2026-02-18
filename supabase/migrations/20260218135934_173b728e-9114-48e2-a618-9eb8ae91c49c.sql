-- Enable realtime for key Asha tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.asha_datasets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asha_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asha_insights;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asha_document_entities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asha_reports;

-- Add ON DELETE CASCADE to session_id foreign keys
-- asha_datasets
ALTER TABLE public.asha_datasets DROP CONSTRAINT IF EXISTS asha_datasets_session_id_fkey;
ALTER TABLE public.asha_datasets ADD CONSTRAINT asha_datasets_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.asha_sessions(id) ON DELETE CASCADE;

-- asha_documents
ALTER TABLE public.asha_documents DROP CONSTRAINT IF EXISTS asha_documents_session_id_fkey;
ALTER TABLE public.asha_documents ADD CONSTRAINT asha_documents_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.asha_sessions(id) ON DELETE CASCADE;

-- asha_reports
ALTER TABLE public.asha_reports DROP CONSTRAINT IF EXISTS asha_reports_session_id_fkey;
ALTER TABLE public.asha_reports ADD CONSTRAINT asha_reports_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.asha_sessions(id) ON DELETE CASCADE;