GRANT SELECT, INSERT, UPDATE, DELETE ON public.ide_sessions TO authenticated;
GRANT ALL ON public.ide_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asher_code_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asher_code_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asher_code_published_tabs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asher_code_tab_installs TO authenticated;

GRANT ALL ON public.asher_code_projects TO service_role;
GRANT ALL ON public.asher_code_files TO service_role;
GRANT ALL ON public.asher_code_published_tabs TO service_role;
GRANT ALL ON public.asher_code_tab_installs TO service_role;