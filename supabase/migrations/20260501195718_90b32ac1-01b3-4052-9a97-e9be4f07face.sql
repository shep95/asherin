CREATE TABLE public.vedic_charts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  birth_time TEXT NOT NULL,
  tz_offset NUMERIC NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  city_label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vedic_charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own vedic charts" ON public.vedic_charts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own vedic charts" ON public.vedic_charts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own vedic charts" ON public.vedic_charts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own vedic charts" ON public.vedic_charts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX vedic_charts_user_id_idx ON public.vedic_charts(user_id, created_at DESC);

CREATE TRIGGER vedic_charts_updated_at BEFORE UPDATE ON public.vedic_charts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();