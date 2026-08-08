DO $$
DECLARE
  target uuid;
  original text;
  got text;
BEGIN
  SELECT user_id, display_name INTO target, original
  FROM public.profiles ORDER BY created_at LIMIT 1;

  UPDATE public.profiles SET display_name = 'Administrator' WHERE user_id = target;
  SELECT display_name INTO got FROM public.profiles WHERE user_id = target;
  INSERT INTO public._name_guard_probe VALUES ('signup_path_sanitized', got);

  -- restore
  UPDATE public.profiles SET display_name = original WHERE user_id = target;
  SELECT display_name INTO got FROM public.profiles WHERE user_id = target;
  INSERT INTO public._name_guard_probe VALUES ('restored', coalesce(got, '<null>'));
END $$;