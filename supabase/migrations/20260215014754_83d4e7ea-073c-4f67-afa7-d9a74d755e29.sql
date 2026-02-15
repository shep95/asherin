
-- Asha Datasets: stores uploaded file metadata and detected schema
CREATE TABLE public.asha_datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'unknown',
  file_size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'analyzing',
  row_count INTEGER,
  col_count INTEGER,
  quality_score INTEGER,
  schema JSONB DEFAULT '[]'::jsonb,
  issues JSONB DEFAULT '[]'::jsonb,
  date_range TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  description TEXT DEFAULT '',
  project_name TEXT DEFAULT '',
  branch TEXT DEFAULT 'main',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own asha_datasets" ON public.asha_datasets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_asha_datasets_updated_at BEFORE UPDATE ON public.asha_datasets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Asha Insights: AI-generated insights from data
CREATE TABLE public.asha_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  dataset_id UUID REFERENCES public.asha_datasets(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'trend',
  icon TEXT NOT NULL DEFAULT '📊',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own asha_insights" ON public.asha_insights FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Asha Branches: git-style data versioning
CREATE TABLE public.asha_branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.asha_branches(id) ON DELETE SET NULL,
  is_main BOOLEAN NOT NULL DEFAULT false,
  is_protected BOOLEAN NOT NULL DEFAULT false,
  transform_count INTEGER NOT NULL DEFAULT 0,
  conflicts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own asha_branches" ON public.asha_branches FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Asha Workflows
CREATE TABLE public.asha_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  runs_count INTEGER NOT NULL DEFAULT 0,
  last_run TIMESTAMP WITH TIME ZONE,
  template_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own asha_workflows" ON public.asha_workflows FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Asha Reports
CREATE TABLE public.asha_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'executive',
  status TEXT NOT NULL DEFAULT 'draft',
  pages INTEGER,
  content TEXT,
  schedule TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own asha_reports" ON public.asha_reports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_asha_reports_updated_at BEFORE UPDATE ON public.asha_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Asha Query History
CREATE TABLE public.asha_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  query TEXT NOT NULL,
  response TEXT NOT NULL DEFAULT '',
  response_type TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own asha_queries" ON public.asha_queries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage bucket for asha datasets
INSERT INTO storage.buckets (id, name, public) VALUES ('asha-data', 'asha-data', false);

CREATE POLICY "Users can upload own asha data" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'asha-data' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own asha data" ON storage.objects FOR SELECT USING (bucket_id = 'asha-data' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own asha data" ON storage.objects FOR DELETE USING (bucket_id = 'asha-data' AND auth.uid()::text = (storage.foldername(name))[1]);
