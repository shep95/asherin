
-- ── Vibe Video: Projects ─────────────────────────────────────
CREATE TABLE public.vibe_video_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'New Video Project',
  template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vibe_video_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own video projects"
  ON public.vibe_video_projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_vibe_video_projects_updated_at
  BEFORE UPDATE ON public.vibe_video_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Vibe Video: Versions ─────────────────────────────────────
CREATE TABLE public.vibe_video_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.vibe_video_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.vibe_video_versions(id) ON DELETE SET NULL,
  version_number INT NOT NULL DEFAULT 1,
  prompt TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds NUMERIC,
  style_preset TEXT,
  is_uploaded BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vibe_video_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own video versions"
  ON public.vibe_video_versions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Vibe Video: Messages ─────────────────────────────────────
CREATE TABLE public.vibe_video_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.vibe_video_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL DEFAULT '',
  version_id UUID REFERENCES public.vibe_video_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vibe_video_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own video messages"
  ON public.vibe_video_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Storage bucket for videos ────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('vibe-video', 'vibe-video', true);

CREATE POLICY "Users upload own videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vibe-video' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vibe-video' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read vibe videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vibe-video');

CREATE POLICY "Users delete own videos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'vibe-video' AND auth.uid()::text = (storage.foldername(name))[1]);
