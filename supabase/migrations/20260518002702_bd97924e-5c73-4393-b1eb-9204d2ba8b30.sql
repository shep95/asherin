-- Hoodies merch interest voting (1 vote per IP)
CREATE TABLE public.hoodie_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash TEXT NOT NULL UNIQUE,
  vote TEXT NOT NULL CHECK (vote IN ('yes','no')),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hoodie_votes_vote ON public.hoodie_votes(vote);

ALTER TABLE public.hoodie_votes ENABLE ROW LEVEL SECURITY;

-- Public can read aggregate counts via the function below; no direct row reads exposed.
-- Block all client reads/writes; voting only happens through the edge function (service role).
CREATE POLICY "no direct access" ON public.hoodie_votes FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- Aggregate function callable by anon for live percentages
CREATE OR REPLACE FUNCTION public.hoodie_vote_totals()
RETURNS TABLE(yes_count BIGINT, no_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE vote = 'yes') AS yes_count,
    COUNT(*) FILTER (WHERE vote = 'no')  AS no_count
  FROM public.hoodie_votes;
$$;

GRANT EXECUTE ON FUNCTION public.hoodie_vote_totals() TO anon, authenticated;