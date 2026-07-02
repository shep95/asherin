
-- 1) Add theory to enum
ALTER TYPE public.forum_category ADD VALUE IF NOT EXISTS 'theory';

-- 2) Replace SELECT policy on forum_posts to hide bugs from non-admins
DROP POLICY IF EXISTS "Forum posts are publicly readable" ON public.forum_posts;
CREATE POLICY "Forum posts visible except bugs"
  ON public.forum_posts FOR SELECT
  USING (
    category <> 'bug'
    OR (auth.uid() IS NOT NULL AND public.is_admin_user(auth.uid()))
  );

-- 3) Votes table
CREATE TABLE IF NOT EXISTS public.forum_post_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_post_votes TO authenticated;
GRANT ALL ON public.forum_post_votes TO service_role;

ALTER TABLE public.forum_post_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes are publicly readable"
  ON public.forum_post_votes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own vote"
  ON public.forum_post_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own vote"
  ON public.forum_post_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own vote"
  ON public.forum_post_votes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_forum_post_votes_post ON public.forum_post_votes(post_id);
