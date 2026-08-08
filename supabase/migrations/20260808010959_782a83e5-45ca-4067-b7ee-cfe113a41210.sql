-- Canonicalises a display name so the blocklist can stay a flat word list.
-- Mirrors src/lib/auth/blockedNames.ts::normalizeName.
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

  -- Strip diacritics/fullwidth, lowercase, trim.
  s := lower(btrim(unaccent_fallback(raw)));

  -- Digits-only names compare verbatim so '0' and '12345' still match.
  IF s ~ '^[0-9]+$' THEN RETURN s; END IF;

  -- Leetspeak folding, then drop every non-alphanumeric separator.
  s := translate(s, '013457@$!|', 'oieast' || 'aas' || 'i');
  s := regexp_replace(s, '[^a-z0-9]', '', 'g');
  RETURN s;
END;
$$;

-- Minimal ASCII folder; avoids depending on the unaccent extension.
CREATE OR REPLACE FUNCTION public.unaccent_fallback(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT translate(
    raw,
    'àáâãäåÀÁÂÃÄÅèéêëÈÉÊËìíîïÌÍÎÏòóôõöÒÓÔÕÖùúûüÙÚÛÜñÑçÇ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_blocked_display_name(raw text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.normalize_display_name(raw) = ANY (ARRAY[
    -- SQL keywords
    'select','drop','insert','delete','update','where','from','join','union',
    'create','alter','table','database','exec','execute','truncate','having',
    'order','group','limit','offset','into','values','declare','cast','convert',
    -- system / admin
    'admin','administrator','root','superuser','system','god','owner','mod',
    'moderator','staff','support','helpdesk','sysadmin','devops','operator','sudo','su',
    -- dev traps
    'null','undefined','true','false','nan','none','nil','void','test','debug',
    'localhost','default','unknown','error','exception',
    -- social engineering
    'official','verified','real','authentic','legit','team','security','account',
    'service','bot','autopilot','internal','corp','corporate',
    -- reserved routes
    'api','app','www','mail','email','login','signup','register','dashboard',
    'settings','profile','home','index','about','contact','help','faq','terms',
    'privacy','billing',
    -- numeric edge cases
    '0','1','00','000','123','1234','12345',
    -- brand impersonation
    'asherin','aureon','asher','zophiel','houseofasher'
  ]);
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_display_name(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unaccent_fallback(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_blocked_display_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blocked_display_name(text) TO authenticated, service_role;

-- Authoritative gate. The client check is advisory; this one cannot be bypassed
-- by calling the REST/auth API directly or by arriving via Google OAuth.
CREATE OR REPLACE FUNCTION public.tg_guard_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.display_name IS NULL OR NOT public.is_blocked_display_name(NEW.display_name) THEN
    RETURN NEW;
  END IF;

  -- No JWT context => the row is being created by the signup trigger
  -- (email/password or OAuth). Failing here would strand the account with no
  -- profile at all, so degrade to a neutral placeholder instead.
  IF auth.uid() IS NULL THEN
    NEW.display_name := 'user_' || left(replace(NEW.user_id::text, '-', ''), 8);
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'reserved_display_name'
    USING HINT = 'That name is reserved. Please choose another.';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_guard_display_name() FROM PUBLIC;

DROP TRIGGER IF EXISTS guard_display_name ON public.profiles;
CREATE TRIGGER guard_display_name
BEFORE INSERT OR UPDATE OF display_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_display_name();