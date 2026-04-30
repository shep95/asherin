
-- Visibility enum
CREATE TYPE public.asher_code_visibility AS ENUM ('private', 'team', 'organization', 'public');

-- Projects
CREATE TABLE public.asher_code_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  language TEXT NOT NULL DEFAULT 'javascript',
  template TEXT,
  visibility public.asher_code_visibility NOT NULL DEFAULT 'private',
  org_id UUID,
  team_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_asher_code_projects_owner ON public.asher_code_projects(owner_id);
CREATE INDEX idx_asher_code_projects_visibility ON public.asher_code_projects(visibility);

-- Files
CREATE TABLE public.asher_code_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.asher_code_projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'plaintext',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, path)
);
CREATE INDEX idx_asher_code_files_project ON public.asher_code_files(project_id);

-- Published tabs
CREATE TABLE public.asher_code_published_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.asher_code_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT '◈',
  category TEXT NOT NULL DEFAULT 'Custom Apps',
  entry_html TEXT NOT NULL,
  visibility public.asher_code_visibility NOT NULL DEFAULT 'private',
  org_id UUID,
  team_id UUID,
  install_count INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_asher_code_tabs_owner ON public.asher_code_published_tabs(owner_id);
CREATE INDEX idx_asher_code_tabs_visibility ON public.asher_code_published_tabs(visibility);

-- Public-tab installs
CREATE TABLE public.asher_code_tab_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES public.asher_code_published_tabs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tab_id, user_id)
);
CREATE INDEX idx_asher_code_installs_user ON public.asher_code_tab_installs(user_id);

-- Enable RLS
ALTER TABLE public.asher_code_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_code_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_code_published_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asher_code_tab_installs ENABLE ROW LEVEL SECURITY;

-- ── Projects policies ──
CREATE POLICY "asher_code_projects_owner_all"
  ON public.asher_code_projects FOR ALL
  USING (owner_id = auth.uid() OR public.is_asher_super_owner(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_asher_super_owner(auth.uid()));

CREATE POLICY "asher_code_projects_view_public"
  ON public.asher_code_projects FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "asher_code_projects_view_team"
  ON public.asher_code_projects FOR SELECT
  USING (visibility = 'team' AND team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id));

CREATE POLICY "asher_code_projects_view_org"
  ON public.asher_code_projects FOR SELECT
  USING (visibility = 'organization' AND org_id IS NOT NULL AND public.asher_is_org_member(auth.uid(), org_id));

-- ── Files policies (mirror project access) ──
CREATE POLICY "asher_code_files_owner_all"
  ON public.asher_code_files FOR ALL
  USING (EXISTS (SELECT 1 FROM public.asher_code_projects p
                 WHERE p.id = project_id
                   AND (p.owner_id = auth.uid() OR public.is_asher_super_owner(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.asher_code_projects p
                      WHERE p.id = project_id
                        AND (p.owner_id = auth.uid() OR public.is_asher_super_owner(auth.uid()))));

CREATE POLICY "asher_code_files_view_shared"
  ON public.asher_code_files FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.asher_code_projects p
    WHERE p.id = project_id AND (
      p.visibility = 'public'
      OR (p.visibility = 'team' AND p.team_id IS NOT NULL AND public.is_team_member(auth.uid(), p.team_id))
      OR (p.visibility = 'organization' AND p.org_id IS NOT NULL AND public.asher_is_org_member(auth.uid(), p.org_id))
    )
  ));

-- ── Published tabs policies ──
CREATE POLICY "asher_code_tabs_owner_all"
  ON public.asher_code_published_tabs FOR ALL
  USING (owner_id = auth.uid() OR public.is_asher_super_owner(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_asher_super_owner(auth.uid()));

CREATE POLICY "asher_code_tabs_view_public"
  ON public.asher_code_published_tabs FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "asher_code_tabs_view_team"
  ON public.asher_code_published_tabs FOR SELECT
  USING (visibility = 'team' AND team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id));

CREATE POLICY "asher_code_tabs_view_org"
  ON public.asher_code_published_tabs FOR SELECT
  USING (visibility = 'organization' AND org_id IS NOT NULL AND public.asher_is_org_member(auth.uid(), org_id));

-- ── Installs policies ──
CREATE POLICY "asher_code_installs_self"
  ON public.asher_code_tab_installs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Triggers for updated_at ──
CREATE TRIGGER trg_asher_code_projects_updated
  BEFORE UPDATE ON public.asher_code_projects
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TRIGGER trg_asher_code_files_updated
  BEFORE UPDATE ON public.asher_code_files
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TRIGGER trg_asher_code_tabs_updated
  BEFORE UPDATE ON public.asher_code_published_tabs
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
