CREATE POLICY "Users can delete own briefing profile"
ON public.briefing_profiles FOR DELETE
USING (auth.uid() = user_id);