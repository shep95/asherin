CREATE POLICY "Admin views all activity"
  ON public.account_activity_log FOR SELECT
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin views all sessions"
  ON public.user_sessions FOR SELECT
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin views all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin_user(auth.uid()));