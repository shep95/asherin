
-- Flush stuck queue
UPDATE public.intel_job_queue
   SET status = 'failed', finished_at = now()
 WHERE status IN ('waiting', 'running')
   AND created_at < now() - interval '30 seconds';

-- Add per-user dedup: cap waiting+running jobs per user/job_type at 3
CREATE OR REPLACE FUNCTION public.enforce_intel_job_user_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _active INT;
BEGIN
  SELECT COUNT(*) INTO _active
    FROM public.intel_job_queue
   WHERE user_id = NEW.user_id
     AND job_type = NEW.job_type
     AND status IN ('waiting', 'running');

  IF _active >= 3 THEN
    RAISE EXCEPTION 'INTEL_JOB_USER_CAP: You already have % active % jobs. Please wait for them to finish.', _active, NEW.job_type
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_intel_job_user_cap ON public.intel_job_queue;
CREATE TRIGGER trg_enforce_intel_job_user_cap
BEFORE INSERT ON public.intel_job_queue
FOR EACH ROW
EXECUTE FUNCTION public.enforce_intel_job_user_cap();
