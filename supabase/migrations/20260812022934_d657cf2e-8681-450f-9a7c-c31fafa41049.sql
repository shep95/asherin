CREATE TABLE IF NOT EXISTS public.download_counters (
  slug TEXT PRIMARY KEY,
  count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.download_counters TO service_role;

ALTER TABLE public.download_counters ENABLE ROW LEVEL SECURITY;

-- Allowlist guard: only known, published assets may be counted.
CREATE OR REPLACE FUNCTION public.is_countable_download(_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _slug IN ('asherin-agent-complete');
$$;

CREATE OR REPLACE FUNCTION public.get_download_count(_slug TEXT)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT c.count FROM public.download_counters c WHERE c.slug = _slug),
    0::BIGINT
  );
$$;

CREATE OR REPLACE FUNCTION public.record_download(_slug TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count BIGINT;
BEGIN
  IF NOT public.is_countable_download(_slug) THEN
    RAISE EXCEPTION 'unknown download key' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.download_counters AS d (slug, count, updated_at)
  VALUES (_slug, 1, now())
  ON CONFLICT (slug) DO UPDATE
    SET count = d.count + 1, updated_at = now()
  RETURNING d.count INTO new_count;

  RETURN new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.is_countable_download(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_download_count(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_download(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_download_count(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_download(TEXT) TO anon, authenticated, service_role;