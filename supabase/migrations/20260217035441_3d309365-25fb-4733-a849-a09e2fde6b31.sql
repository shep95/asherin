
-- Documents table: stores uploaded documents and their metadata
CREATE TABLE public.asha_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.asha_sessions(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'unknown',
  file_size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'unknown', -- contract, invoice, email, report, legal, medical, research, other
  status TEXT NOT NULL DEFAULT 'uploading', -- uploading, processing, ready, error
  page_count INTEGER DEFAULT 0,
  language TEXT DEFAULT 'en',
  summary TEXT DEFAULT '',
  extracted_text TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own asha_documents"
  ON public.asha_documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Entities extracted from documents
CREATE TABLE public.asha_document_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES public.asha_documents(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL DEFAULT 'unknown', -- party, date, amount, clause, obligation, vendor, person, organization, location, term
  entity_value TEXT NOT NULL,
  entity_label TEXT DEFAULT '',
  confidence NUMERIC(4,2) DEFAULT 0.0,
  context TEXT DEFAULT '', -- surrounding text snippet
  metadata JSONB DEFAULT '{}'::jsonb,
  page_number INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_document_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own asha_document_entities"
  ON public.asha_document_entities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Cross-document links
CREATE TABLE public.asha_document_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_document_id UUID NOT NULL REFERENCES public.asha_documents(id) ON DELETE CASCADE,
  target_document_id UUID NOT NULL REFERENCES public.asha_documents(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'reference', -- reference, related, supersedes, amends
  link_reason TEXT DEFAULT '',
  confidence NUMERIC(4,2) DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asha_document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own asha_document_links"
  ON public.asha_document_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_asha_documents_user ON public.asha_documents(user_id);
CREATE INDEX idx_asha_documents_status ON public.asha_documents(status);
CREATE INDEX idx_asha_documents_doc_type ON public.asha_documents(doc_type);
CREATE INDEX idx_asha_document_entities_doc ON public.asha_document_entities(document_id);
CREATE INDEX idx_asha_document_entities_type ON public.asha_document_entities(entity_type);
CREATE INDEX idx_asha_document_entities_user ON public.asha_document_entities(user_id);
CREATE INDEX idx_asha_document_links_source ON public.asha_document_links(source_document_id);
CREATE INDEX idx_asha_document_links_target ON public.asha_document_links(target_document_id);
