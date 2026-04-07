
-- Create axrlen_brains table for admin-managed knowledge packs
CREATE TABLE public.axrlen_brains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  file_name TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.axrlen_brains ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active brains
CREATE POLICY "Authenticated users can view active axrlen brains"
  ON public.axrlen_brains
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can insert
CREATE POLICY "Admin can insert axrlen brains"
  ON public.axrlen_brains
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));

-- Only admin can update
CREATE POLICY "Admin can update axrlen brains"
  ON public.axrlen_brains
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- Only admin can delete
CREATE POLICY "Admin can delete axrlen brains"
  ON public.axrlen_brains
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_axrlen_brains_updated_at
  BEFORE UPDATE ON public.axrlen_brains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
