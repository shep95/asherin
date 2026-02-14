-- Create storage bucket for user library files
INSERT INTO storage.buckets (id, name, public)
VALUES ('library', 'library', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload files to their own folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'library'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own files
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'library'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'library'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create a table to track library file metadata
CREATE TABLE public.library_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT 'unknown',
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.library_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own library files"
ON public.library_files FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own library files"
ON public.library_files FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own library files"
ON public.library_files FOR DELETE
USING (auth.uid() = user_id);