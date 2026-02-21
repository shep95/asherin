
-- Add session_id to asha_queries so conversations are scoped per session
ALTER TABLE public.asha_queries ADD COLUMN session_id uuid REFERENCES public.asha_sessions(id) ON DELETE CASCADE;

-- Index for fast session-scoped lookups
CREATE INDEX idx_asha_queries_session ON public.asha_queries(session_id);
