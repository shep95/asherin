
-- ═══════════════════════════════════════════════════════════════
-- VIBE IMAGER: Projects, Versions, and Storage
-- ═══════════════════════════════════════════════════════════════

-- Projects table (each "session" in Vibe Imager)
CREATE TABLE public.vibe_imager_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  template TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vibe_imager_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vibe projects"
  ON public.vibe_imager_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own vibe projects"
  ON public.vibe_imager_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vibe projects"
  ON public.vibe_imager_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vibe projects"
  ON public.vibe_imager_projects FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_vibe_projects_updated_at
  BEFORE UPDATE ON public.vibe_imager_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Versions table (each image iteration, supports branching)
CREATE TABLE public.vibe_imager_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.vibe_imager_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.vibe_imager_versions(id),
  version_number INT NOT NULL DEFAULT 1,
  prompt TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  style_preset TEXT,
  is_uploaded BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vibe_imager_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vibe versions"
  ON public.vibe_imager_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own vibe versions"
  ON public.vibe_imager_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vibe versions"
  ON public.vibe_imager_versions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_vibe_versions_project ON public.vibe_imager_versions(project_id);
CREATE INDEX idx_vibe_versions_parent ON public.vibe_imager_versions(parent_id);

-- Chat messages for conversational refinement
CREATE TABLE public.vibe_imager_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.vibe_imager_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  version_id UUID REFERENCES public.vibe_imager_versions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vibe_imager_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vibe messages"
  ON public.vibe_imager_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own vibe messages"
  ON public.vibe_imager_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_vibe_messages_project ON public.vibe_imager_messages(project_id);

-- Storage bucket for generated/uploaded images
INSERT INTO storage.buckets (id, name, public)
VALUES ('vibe-imager', 'vibe-imager', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload vibe images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vibe-imager' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view vibe images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vibe-imager');

CREATE POLICY "Users can delete own vibe images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'vibe-imager' AND auth.uid()::text = (storage.foldername(name))[1]);
