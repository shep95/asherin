
-- Persona Store: shared personas that users can publish and others can install
CREATE TABLE public.shared_personas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'target',
  description text NOT NULL DEFAULT '',
  system_prompt text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  is_public boolean NOT NULL DEFAULT false,
  installs integer NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_personas ENABLE ROW LEVEL SECURITY;

-- Anyone can view public personas
CREATE POLICY "Anyone can view public personas"
ON public.shared_personas FOR SELECT
USING (is_public = true OR auth.uid() = user_id);

-- Users can create their own
CREATE POLICY "Users can create own personas"
ON public.shared_personas FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own
CREATE POLICY "Users can update own personas"
ON public.shared_personas FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own
CREATE POLICY "Users can delete own personas"
ON public.shared_personas FOR DELETE
USING (auth.uid() = user_id);

-- Track which personas users have installed from the store
CREATE TABLE public.installed_personas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  persona_id uuid NOT NULL REFERENCES public.shared_personas(id) ON DELETE CASCADE,
  installed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, persona_id)
);

ALTER TABLE public.installed_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own installed_personas"
ON public.installed_personas FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_shared_personas_public ON public.shared_personas(is_public) WHERE is_public = true;
CREATE INDEX idx_shared_personas_user ON public.shared_personas(user_id);
CREATE INDEX idx_installed_personas_user ON public.installed_personas(user_id);
