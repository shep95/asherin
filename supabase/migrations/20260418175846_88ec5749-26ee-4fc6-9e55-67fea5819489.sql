-- ============================================
-- RESEARCH WORKSPACES
-- ============================================
CREATE TABLE public.research_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '◈',
  color TEXT DEFAULT '#888888',
  is_archived BOOLEAN DEFAULT false,
  pinned BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.research_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own workspaces" ON public.research_workspaces FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_workspaces_user ON public.research_workspaces(user_id, updated_at DESC);

CREATE TABLE public.workspace_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.research_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL, -- 'query' | 'result' | 'map_state' | 'note' | 'annotation' | 'export'
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}'::jsonb,
  source_url TEXT,
  tags TEXT[] DEFAULT '{}',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.workspace_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own workspace items" ON public.workspace_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_workspace_items_ws ON public.workspace_items(workspace_id, position);

-- ============================================
-- ANNOTATIONS (Map nodes, entities, results)
-- ============================================
CREATE TABLE public.intel_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_type TEXT NOT NULL, -- 'node' | 'entity' | 'result' | 'document'
  target_id TEXT NOT NULL, -- node id, entity value, url hash
  workspace_id UUID REFERENCES public.research_workspaces(id) ON DELETE SET NULL,
  note TEXT,
  tags TEXT[] DEFAULT '{}',
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  flag TEXT, -- 'critical' | 'verified' | 'suspicious' | 'dismissed' | null
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.intel_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own annotations" ON public.intel_annotations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_annotations_target ON public.intel_annotations(user_id, target_type, target_id);

-- ============================================
-- SAVED SEARCHES + ALERTS
-- ============================================
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  category TEXT DEFAULT 'web',
  filters JSONB DEFAULT '{}'::jsonb,
  frequency TEXT DEFAULT 'daily', -- 'manual' | 'hourly' | 'daily' | 'weekly'
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_result_count INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  workspace_id UUID REFERENCES public.research_workspaces(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own saved searches" ON public.saved_searches FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.search_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  saved_search_id UUID REFERENCES public.saved_searches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  new_results JSONB DEFAULT '[]'::jsonb,
  result_count INTEGER DEFAULT 0,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.search_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own search alerts" ON public.search_alerts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_alerts_unread ON public.search_alerts(user_id, read, created_at DESC);

-- ============================================
-- CUSTOM SOURCE LISTS
-- ============================================
CREATE TABLE public.custom_source_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  domains TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'general',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.custom_source_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own source lists" ON public.custom_source_lists FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- ENTITY WATCHLIST
-- ============================================
CREATE TABLE public.entity_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- 'person' | 'company' | 'domain' | 'location' | 'keyword'
  entity_value TEXT NOT NULL,
  description TEXT,
  alert_frequency TEXT DEFAULT 'daily',
  enabled BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  mention_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.entity_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own watchlist" ON public.entity_watchlist FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- SHARED INTEL ROOMS (Realtime collaboration)
-- ============================================
CREATE TABLE public.shared_intel_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  share_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  workspace_id UUID REFERENCES public.research_workspaces(id) ON DELETE SET NULL,
  state JSONB DEFAULT '{}'::jsonb, -- map nodes, edges, annotations
  is_public BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.shared_intel_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access on rooms" ON public.shared_intel_rooms FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "anyone can read public rooms" ON public.shared_intel_rooms FOR SELECT USING (is_public = true);

CREATE TABLE public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.shared_intel_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'viewer', -- 'viewer' | 'editor' | 'owner'
  cursor_state JSONB DEFAULT '{}'::jsonb,
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, user_id)
);
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see participants of rooms they joined" ON public.room_participants FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.room_participants rp WHERE rp.room_id = room_participants.room_id AND rp.user_id = auth.uid())
);
CREATE POLICY "users can join rooms" ON public.room_participants FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own participation" ON public.room_participants FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "users can leave" ON public.room_participants FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- AUDIT LOG (Chain of Custody)
-- ============================================
CREATE TABLE public.research_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.research_workspaces(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'query' | 'click' | 'annotate' | 'export' | 'view' | 'share'
  resource_type TEXT,
  resource_id TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  payload_hash TEXT NOT NULL, -- SHA-256 of payload+timestamp
  prev_hash TEXT, -- chain to previous entry
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.research_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own audit log" ON public.research_audit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own audit log" ON public.research_audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_audit_user_time ON public.research_audit_log(user_id, created_at DESC);

-- ============================================
-- SEARCH HISTORY (Session replay)
-- ============================================
CREATE TABLE public.search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.research_workspaces(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  category TEXT DEFAULT 'web',
  filters JSONB DEFAULT '{}'::jsonb,
  result_count INTEGER DEFAULT 0,
  results_snapshot JSONB DEFAULT '[]'::jsonb,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own search history" ON public.search_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_history_user_time ON public.search_history(user_id, created_at DESC);

-- ============================================
-- TIMESTAMP TRIGGERS
-- ============================================
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.research_workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workspace_items_updated_at BEFORE UPDATE ON public.workspace_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_annotations_updated_at BEFORE UPDATE ON public.intel_annotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON public.saved_searches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_source_lists_updated_at BEFORE UPDATE ON public.custom_source_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_watchlist_updated_at BEFORE UPDATE ON public.entity_watchlist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.shared_intel_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();