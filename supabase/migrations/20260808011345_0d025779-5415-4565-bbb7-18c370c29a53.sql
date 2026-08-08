CREATE TABLE IF NOT EXISTS public._name_guard_probe (note text, result text);
DO $$
DECLARE
  target uuid;
  got text;
BEGIN
  SELECT u.id INTO target
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.user_id IS NULL
  LIMIT 1;

  IF target IS NULL THEN
    INSERT INTO public._name_guard_probe VALUES ('signup_path', 'skipped: no user without a profile');
    RETURN;
  END IF;

  INSERT INTO public.profiles (user_id, display_name) VALUES (target, 'Administrator');
  SELECT display_name INTO got FROM public.profiles WHERE user_id = target;
  INSERT INTO public._name_guard_probe VALUES ('signup_path', got);
  DELETE FROM public.profiles WHERE user_id = target;
END $$;