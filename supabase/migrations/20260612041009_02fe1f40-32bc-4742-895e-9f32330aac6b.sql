CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.asher_code_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  file_id text NOT NULL,
  file_path text NOT NULL,
  chunk_index int NOT NULL DEFAULT 0,
  content text NOT NULL,
  content_hash text NOT NULL,
  language text,
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asher_code_embeddings_user_proj_idx
  ON public.asher_code_embeddings (user_id, project_id);
CREATE INDEX IF NOT EXISTS asher_code_embeddings_file_idx
  ON public.asher_code_embeddings (user_id, project_id, file_id);
CREATE UNIQUE INDEX IF NOT EXISTS asher_code_embeddings_unique_chunk
  ON public.asher_code_embeddings (user_id, project_id, file_id, chunk_index);
CREATE INDEX IF NOT EXISTS asher_code_embeddings_vec_idx
  ON public.asher_code_embeddings USING hnsw (embedding vector_cosine_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asher_code_embeddings TO authenticated;
GRANT ALL ON public.asher_code_embeddings TO service_role;

ALTER TABLE public.asher_code_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own code embeddings"
  ON public.asher_code_embeddings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.match_asher_code_chunks(
  _user_id uuid,
  _project_id uuid,
  query_embedding vector(1536),
  match_count int DEFAULT 6
)
RETURNS TABLE (
  id uuid,
  file_id text,
  file_path text,
  chunk_index int,
  content text,
  language text,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.file_id, e.file_path, e.chunk_index, e.content, e.language,
         1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.asher_code_embeddings e
  WHERE e.user_id = _user_id AND e.project_id = _project_id
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE TRIGGER trg_asher_code_embeddings_updated_at
  BEFORE UPDATE ON public.asher_code_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();