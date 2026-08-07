-- job_leads: replace the expression index with a stored generated column so
-- upserts can name real columns as the conflict target.
DROP INDEX IF EXISTS public.idx_job_leads_dedupe;
ALTER TABLE public.job_leads
  ADD COLUMN dedupe_key text
  GENERATED ALWAYS AS (md5(lower(coalesce(url, title || coalesce(company, ''))))) STORED;
CREATE UNIQUE INDEX idx_job_leads_dedupe ON public.job_leads (user_id, dedupe_key);

-- resume_gaps: a gap always belongs to a resume.
DROP INDEX IF EXISTS public.idx_resume_gaps_unique;
DELETE FROM public.resume_gaps WHERE resume_id IS NULL;
ALTER TABLE public.resume_gaps ALTER COLUMN resume_id SET NOT NULL;
CREATE UNIQUE INDEX idx_resume_gaps_unique ON public.resume_gaps (user_id, resume_id, field_key);