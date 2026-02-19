
-- ZALI Design Intelligence Lab tables

-- Projects table
CREATE TABLE public.zali_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  design_type TEXT DEFAULT 'general',
  phase TEXT DEFAULT 'understanding',
  status TEXT DEFAULT 'active',
  research_domains JSONB DEFAULT '[]',
  specifications JSONB DEFAULT '{}',
  cost_analysis JSONB DEFAULT '{}',
  manufacturing JSONB DEFAULT '{}',
  simulation_results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zali_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ZALI projects"
  ON public.zali_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ZALI projects"
  ON public.zali_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ZALI projects"
  ON public.zali_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ZALI projects"
  ON public.zali_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Messages table
CREATE TABLE public.zali_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.zali_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zali_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ZALI messages"
  ON public.zali_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ZALI messages"
  ON public.zali_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ZALI messages"
  ON public.zali_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Research findings table
CREATE TABLE public.zali_research (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.zali_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  confidence NUMERIC DEFAULT 0,
  sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zali_research ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ZALI research"
  ON public.zali_research FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ZALI research"
  ON public.zali_research FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ZALI research"
  ON public.zali_research FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ZALI research"
  ON public.zali_research FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_zali_projects_user ON public.zali_projects(user_id);
CREATE INDEX idx_zali_messages_project ON public.zali_messages(project_id);
CREATE INDEX idx_zali_messages_user ON public.zali_messages(user_id);
CREATE INDEX idx_zali_research_project ON public.zali_research(project_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.zali_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.zali_research;
