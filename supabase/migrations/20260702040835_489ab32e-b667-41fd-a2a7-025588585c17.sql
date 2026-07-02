DROP POLICY IF EXISTS "Users update own vote" ON public.forum_post_votes;
CREATE POLICY "Users update own vote" ON public.forum_post_votes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);