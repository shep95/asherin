
-- Create brains table for user-defined knowledge/context packs
CREATE TABLE public.brains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  system_prompt TEXT DEFAULT '',
  file_ids TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brains ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own brains"
  ON public.brains FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update timestamp trigger
CREATE TRIGGER update_brains_updated_at
  BEFORE UPDATE ON public.brains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
