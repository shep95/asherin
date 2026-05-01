
CREATE TABLE public.chart_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chart_key TEXT NOT NULL,
  chart_label TEXT NOT NULL,
  note TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chart_notes_user_idx ON public.chart_notes (user_id, chart_key, created_at DESC);
ALTER TABLE public.chart_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own chart notes" ON public.chart_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own chart notes" ON public.chart_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own chart notes" ON public.chart_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);
