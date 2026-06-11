
-- Revoke client-side read access on secret columns. Service role retains full access.
REVOKE SELECT (github_token) ON public.github_connections FROM anon, authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.google_accounts FROM anon, authenticated;
REVOKE SELECT (api_key) ON public.user_api_keys FROM anon, authenticated;
REVOKE SELECT (slack_webhook, alert_email) ON public.zerlal_settings FROM anon, authenticated;
