CREATE TABLE IF NOT EXISTS public.intel_job_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'intelmap',
  status TEXT NOT NULL DEFAULT 'waiting',
  queue_position INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intel_job_queue_status ON public.intel_job_queue(job_type, status, created_at);
CREATE INDEX IF NOT EXISTS idx_intel_job_queue_user ON public.intel_job_queue(user_id, created_at DESC);

ALTER TABLE public.intel_job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own jobs" ON public.intel_job_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own jobs" ON public.intel_job_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own jobs" ON public.intel_job_queue FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete their own jobs" ON public.intel_job_queue FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.try_acquire_intel_slot(
  _job_id UUID,
  _job_type TEXT,
  _max_concurrent INT DEFAULT 2
)
RETURNS TABLE(acquired BOOLEAN, queue_pos INT, running_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _running INT;
  _waiting_ahead INT;
BEGIN
  UPDATE public.intel_job_queue
     SET status = 'failed', finished_at = now()
   WHERE job_type = _job_type
     AND status = 'running'
     AND heartbeat_at < now() - interval '60 seconds';

  UPDATE public.intel_job_queue
     SET status = 'failed', finished_at = now()
   WHERE job_type = _job_type
     AND status = 'waiting'
     AND created_at < now() - interval '5 minutes';

  SELECT COUNT(*) INTO _running
    FROM public.intel_job_queue
   WHERE job_type = _job_type AND status = 'running';

  IF _running < _max_concurrent THEN
    UPDATE public.intel_job_queue
       SET status = 'running',
           started_at = now(),
           heartbeat_at = now(),
           queue_position = 0
     WHERE id = _job_id AND status = 'waiting';
    RETURN QUERY SELECT TRUE, 0, _running + 1;
  ELSE
    SELECT COUNT(*) + 1 INTO _waiting_ahead
      FROM public.intel_job_queue
     WHERE job_type = _job_type
       AND status = 'waiting'
       AND created_at < (SELECT created_at FROM public.intel_job_queue WHERE id = _job_id);
    UPDATE public.intel_job_queue SET queue_position = _waiting_ahead WHERE id = _job_id;
    RETURN QUERY SELECT FALSE, _waiting_ahead, _running;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_intel_slot(_job_id UUID, _success BOOLEAN DEFAULT TRUE)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.intel_job_queue
     SET status = CASE WHEN _success THEN 'done' ELSE 'failed' END,
         finished_at = now()
   WHERE id = _job_id;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_intel_slot(_job_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.intel_job_queue SET heartbeat_at = now() WHERE id = _job_id AND status = 'running';
$$;