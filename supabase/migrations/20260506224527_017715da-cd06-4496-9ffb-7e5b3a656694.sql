CREATE OR REPLACE FUNCTION public.is_asher_brain_contributor(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _uid
      AND lower(email) = 'ashernewtonx@gmail.com'
  );
$function$;