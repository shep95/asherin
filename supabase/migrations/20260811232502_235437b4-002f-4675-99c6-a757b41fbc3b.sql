DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'asher_agents','asher_code_projects','asher_code_published_tabs',
    'ava_picks','ava_win_stats','btc_predictions','coding_laws',
    'coding_laws_engine_runs','forum_post_votes','forum_posts',
    'forum_replies','plugins','shared_intel_rooms','signal_definitions'
  ]
  LOOP
    -- Blanket PUBLIC ALL is defence-in-depth debt: RLS is the only thing
    -- standing between an anonymous key and writes. Remove the privilege too.
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;