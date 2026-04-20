CREATE OR REPLACE FUNCTION public.try_acquire_intel_slot(_job_id uuid, _job_type text, _max_concurrent integer DEFAULT 2)
 RETURNS TABLE(acquired boolean, queue_pos integer, running_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _running INT;
  _waiting_ahead INT;
  _my_created TIMESTAMPTZ;
BEGIN
  -- Reclaim zombie running jobs (heartbeat > 45s old)
  UPDATE public.intel_job_queue
     SET status = 'failed', finished_at = now()
   WHERE job_type = _job_type
     AND status = 'running'
     AND heartbeat_at < now() - interval '45 seconds';

  -- Expire stale waiting jobs (older than 8 min)
  UPDATE public.intel_job_queue
     SET status = 'failed', finished_at = now()
   WHERE job_type = _job_type
     AND status = 'waiting'
     AND created_at < now() - interval '8 minutes';

  -- Lock running count
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
    -- Get my creation timestamp once
    SELECT created_at INTO _my_created
      FROM public.intel_job_queue WHERE id = _job_id;

    -- Count waiting jobs strictly ahead of me using (created_at, id) ordering
    SELECT COUNT(*) INTO _waiting_ahead
      FROM public.intel_job_queue
     WHERE job_type = _job_type
       AND status = 'waiting'
       AND id <> _job_id
       AND (created_at < _my_created
            OR (created_at = _my_created AND id < _job_id));

    -- Position = jobs ahead + 1 (so first in line is 1, not 0)
    UPDATE public.intel_job_queue
       SET queue_position = _waiting_ahead + 1
     WHERE id = _job_id;

    RETURN QUERY SELECT FALSE, _waiting_ahead + 1, _running;
  END IF;
END;
$function$;