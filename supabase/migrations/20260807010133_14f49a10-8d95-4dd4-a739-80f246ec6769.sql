UPDATE public.mesh_dossiers
SET status = 'queued', error_message = NULL, updated_at = now()
WHERE status IN ('ready', 'failed');