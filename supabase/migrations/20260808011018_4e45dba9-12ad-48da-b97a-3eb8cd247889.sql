CREATE OR REPLACE FUNCTION public.normalize_display_name(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  s := lower(btrim(public.unaccent_fallback(raw)));
  IF s ~ '^[0-9]+$' THEN RETURN s; END IF;
  -- 0->o 1->i 3->e 4->a 5->s 7->t @->a $->s !->i |->i
  s := translate(s, '013457@$!|', 'oieastasii');
  s := regexp_replace(s, '[^a-z0-9]', '', 'g');
  RETURN s;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.normalize_display_name(text) FROM PUBLIC;