-- Asher operator audit log
CREATE TABLE public.asher_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asher_audit_log_user_created ON public.asher_audit_log(user_id, created_at DESC);

ALTER TABLE public.asher_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators view own audit log"
  ON public.asher_audit_log FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

CREATE POLICY "Operators insert own audit log"
  ON public.asher_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Asher saved targets / dossier vault
CREATE TABLE public.asher_saved_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asher_saved_targets_user ON public.asher_saved_targets(user_id, created_at DESC);

ALTER TABLE public.asher_saved_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators view own saved targets"
  ON public.asher_saved_targets FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

CREATE POLICY "Operators insert own saved targets"
  ON public.asher_saved_targets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Operators update own saved targets"
  ON public.asher_saved_targets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Operators delete own saved targets"
  ON public.asher_saved_targets FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_asher_saved_targets_updated_at
  BEFORE UPDATE ON public.asher_saved_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();