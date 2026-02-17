
-- Teams
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  owner_id uuid NOT NULL,
  icon text NOT NULL DEFAULT '🏢',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Team members
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','admin','analyst','viewer')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team invites
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin','analyst','viewer')),
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Notebooks
CREATE TABLE public.notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Untitled Notebook',
  description text NOT NULL DEFAULT '',
  owner_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version integer NOT NULL DEFAULT 1,
  schedule text, -- cron expression or null
  last_run_at timestamptz,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;

-- Notebook cells
CREATE TABLE public.notebook_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  cell_type text NOT NULL DEFAULT 'text' CHECK (cell_type IN ('text','query','visualization','code','data_source')),
  content text NOT NULL DEFAULT '',
  output text,
  position integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notebook_cells ENABLE ROW LEVEL SECURITY;

-- Notebook versions
CREATE TABLE public.notebook_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}',
  changed_by uuid NOT NULL,
  change_summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notebook_versions ENABLE ROW LEVEL SECURITY;

-- Notebook shares
CREATE TABLE public.notebook_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  user_id uuid,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view','clone','edit','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notebook_id, user_id)
);
ALTER TABLE public.notebook_shares ENABLE ROW LEVEL SECURITY;

-- Comments on notebook cells
CREATE TABLE public.notebook_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  cell_id uuid REFERENCES public.notebook_cells(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  parent_id uuid REFERENCES public.notebook_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notebook_comments ENABLE ROW LEVEL SECURITY;

-- Data permissions (row/column level)
CREATE TABLE public.data_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  dataset_id uuid REFERENCES public.asha_datasets(id) ON DELETE CASCADE,
  user_id uuid,
  sensitivity_level text NOT NULL DEFAULT 'public' CHECK (sensitivity_level IN ('public','internal','confidential','restricted')),
  visible_columns text[] NOT NULL DEFAULT '{}',
  row_filter jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.data_permissions ENABLE ROW LEVEL SECURITY;

-- Audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb NOT NULL DEFAULT '{}',
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Plugins marketplace
CREATE TABLE public.plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'analysis' CHECK (category IN ('connector','analysis','visualization','export','automation')),
  author text NOT NULL DEFAULT 'Aureon',
  icon text NOT NULL DEFAULT '🔌',
  version text NOT NULL DEFAULT '1.0.0',
  downloads integer NOT NULL DEFAULT 0,
  rating numeric(2,1) NOT NULL DEFAULT 0,
  is_premium boolean NOT NULL DEFAULT false,
  price_cents integer NOT NULL DEFAULT 0,
  config_schema jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plugins ENABLE ROW LEVEL SECURITY;

-- Installed plugins per user
CREATE TABLE public.installed_plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plugin_id uuid NOT NULL REFERENCES public.plugins(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '{}',
  installed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, plugin_id)
);
ALTER TABLE public.installed_plugins ENABLE ROW LEVEL SECURITY;

-- Helper function to check team membership
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id);
$$;

-- Helper function to check team role
CREATE OR REPLACE FUNCTION public.get_team_role(_user_id uuid, _team_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id LIMIT 1;
$$;

-- RLS Policies

-- Teams: members can view, owner can modify
CREATE POLICY "Team members can view team" ON public.teams FOR SELECT USING (public.is_team_member(auth.uid(), id));
CREATE POLICY "Owner can update team" ON public.teams FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owner can delete team" ON public.teams FOR DELETE USING (owner_id = auth.uid());
CREATE POLICY "Authenticated users can create teams" ON public.teams FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Team members
CREATE POLICY "Team members can view members" ON public.team_members FOR SELECT USING (public.is_team_member(auth.uid(), team_id));
CREATE POLICY "Admin can manage members" ON public.team_members FOR INSERT WITH CHECK (public.get_team_role(auth.uid(), team_id) IN ('owner','admin') OR auth.uid() = user_id);
CREATE POLICY "Admin can update members" ON public.team_members FOR UPDATE USING (public.get_team_role(auth.uid(), team_id) IN ('owner','admin'));
CREATE POLICY "Admin can remove members" ON public.team_members FOR DELETE USING (public.get_team_role(auth.uid(), team_id) IN ('owner','admin') OR auth.uid() = user_id);

-- Team invites
CREATE POLICY "Team admins can manage invites" ON public.team_invites FOR ALL USING (public.get_team_role(auth.uid(), team_id) IN ('owner','admin')) WITH CHECK (public.get_team_role(auth.uid(), team_id) IN ('owner','admin'));
CREATE POLICY "Invitees can view own invites" ON public.team_invites FOR SELECT USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));
CREATE POLICY "Invitees can update own invites" ON public.team_invites FOR UPDATE USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Notebooks
CREATE POLICY "Owner can manage notebooks" ON public.notebooks FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Shared users can view notebooks" ON public.notebooks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.notebook_shares WHERE notebook_id = id AND user_id = auth.uid())
  OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id))
);

-- Notebook cells
CREATE POLICY "Notebook owner can manage cells" ON public.notebook_cells FOR ALL USING (
  EXISTS (SELECT 1 FROM public.notebooks WHERE id = notebook_id AND owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.notebooks WHERE id = notebook_id AND owner_id = auth.uid())
);
CREATE POLICY "Shared users can view cells" ON public.notebook_cells FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.notebooks n JOIN public.notebook_shares s ON s.notebook_id = n.id WHERE n.id = notebook_id AND s.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_id AND n.team_id IS NOT NULL AND public.is_team_member(auth.uid(), n.team_id))
);

-- Notebook versions
CREATE POLICY "Notebook participants can view versions" ON public.notebook_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.notebooks WHERE id = notebook_id AND (owner_id = auth.uid() OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id))))
  OR EXISTS (SELECT 1 FROM public.notebook_shares WHERE notebook_id = notebook_versions.notebook_id AND user_id = auth.uid())
);
CREATE POLICY "Notebook editors can create versions" ON public.notebook_versions FOR INSERT WITH CHECK (auth.uid() = changed_by);

-- Notebook shares
CREATE POLICY "Notebook owner can manage shares" ON public.notebook_shares FOR ALL USING (
  EXISTS (SELECT 1 FROM public.notebooks WHERE id = notebook_id AND owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.notebooks WHERE id = notebook_id AND owner_id = auth.uid())
);
CREATE POLICY "Users can view own shares" ON public.notebook_shares FOR SELECT USING (user_id = auth.uid());

-- Comments
CREATE POLICY "Notebook participants can view comments" ON public.notebook_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.notebooks WHERE id = notebook_id AND (owner_id = auth.uid() OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id))))
  OR EXISTS (SELECT 1 FROM public.notebook_shares WHERE notebook_id = notebook_comments.notebook_id AND user_id = auth.uid())
);
CREATE POLICY "Users can create comments" ON public.notebook_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.notebook_comments FOR DELETE USING (auth.uid() = user_id);

-- Data permissions
CREATE POLICY "Team members can view data permissions" ON public.data_permissions FOR SELECT USING (public.is_team_member(auth.uid(), team_id));
CREATE POLICY "Team admins can manage data permissions" ON public.data_permissions FOR ALL USING (public.get_team_role(auth.uid(), team_id) IN ('owner','admin')) WITH CHECK (public.get_team_role(auth.uid(), team_id) IN ('owner','admin'));

-- Audit log
CREATE POLICY "Team members can view audit log" ON public.audit_log FOR SELECT USING (
  team_id IS NULL AND user_id = auth.uid()
  OR (team_id IS NOT NULL AND public.get_team_role(auth.uid(), team_id) IN ('owner','admin'))
);
CREATE POLICY "Authenticated users can create audit entries" ON public.audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Plugins (public read)
CREATE POLICY "Anyone can view plugins" ON public.plugins FOR SELECT USING (true);

-- Installed plugins
CREATE POLICY "Users can manage own installed plugins" ON public.installed_plugins FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notebooks_updated_at BEFORE UPDATE ON public.notebooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notebook_cells_updated_at BEFORE UPDATE ON public.notebook_cells FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
