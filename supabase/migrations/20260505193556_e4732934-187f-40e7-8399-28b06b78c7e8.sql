
-- Forum category enum
DO $$ BEGIN
  CREATE TYPE public.forum_category AS ENUM ('idea', 'leak', 'bug');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Posts table
CREATE TABLE public.forum_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category public.forum_category NOT NULL DEFAULT 'idea',
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_forum_posts_created ON public.forum_posts (created_at DESC);
CREATE INDEX idx_forum_posts_category ON public.forum_posts (category, created_at DESC);

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Forum posts are publicly readable"
  ON public.forum_posts FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create posts"
  ON public.forum_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can update their own posts"
  ON public.forum_posts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authors can delete their own posts"
  ON public.forum_posts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Replies table
CREATE TABLE public.forum_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_forum_replies_post ON public.forum_replies (post_id, created_at ASC);

ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Forum replies are publicly readable"
  ON public.forum_replies FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create replies"
  ON public.forum_replies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can update their own replies"
  ON public.forum_replies FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authors can delete their own replies"
  ON public.forum_replies FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Reuse update_updated_at_column if present, else create
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_forum_posts_updated
BEFORE UPDATE ON public.forum_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_forum_replies_updated
BEFORE UPDATE ON public.forum_replies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
