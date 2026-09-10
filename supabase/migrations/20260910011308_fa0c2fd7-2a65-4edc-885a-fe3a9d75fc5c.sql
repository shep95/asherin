CREATE POLICY "own notifications insertable" ON public.intel_notifications
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

GRANT INSERT ON public.intel_notifications TO authenticated;