
-- ── Sensitive column hardening ────────────────────────────────────────────
-- Revoke SELECT on secret-bearing columns from anon/authenticated. RLS still
-- protects rows; this prevents the client API from ever returning the secret
-- values. Edge functions (service_role) continue to have full access.

REVOKE SELECT (github_token) ON public.github_connections FROM authenticated, anon;
REVOKE SELECT (access_token, refresh_token) ON public.google_accounts FROM authenticated, anon;
REVOKE SELECT (api_key) ON public.user_api_keys FROM authenticated, anon;
REVOKE SELECT (slack_webhook, alert_email) ON public.zerlal_settings FROM authenticated, anon;

-- ── Lock the email-queue RPCs to authorized callers only ─────────────────
-- These SECURITY DEFINER wrappers are intended for the process-email-queue
-- edge function (service_role). Also pin search_path to satisfy the linter.

ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
