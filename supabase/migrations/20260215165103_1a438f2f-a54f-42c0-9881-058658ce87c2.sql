
-- Intelligence Briefing profiles
CREATE TABLE public.briefing_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  competitors TEXT[] NOT NULL DEFAULT '{}',
  key_markets TEXT[] NOT NULL DEFAULT '{}',
  technology_stack TEXT[] NOT NULL DEFAULT '{}',
  investment_interests TEXT[] NOT NULL DEFAULT '{}',
  tracked_people TEXT[] NOT NULL DEFAULT '{}',
  regulatory_bodies TEXT[] NOT NULL DEFAULT '{}',
  custom_topics TEXT[] NOT NULL DEFAULT '{}',
  company_name TEXT DEFAULT '',
  delivery_time TEXT NOT NULL DEFAULT '08:00',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.briefing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own briefing profile" ON public.briefing_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own briefing profile" ON public.briefing_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own briefing profile" ON public.briefing_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Generated briefing reports
CREATE TABLE public.briefing_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Morning Brief',
  content TEXT NOT NULL DEFAULT '',
  sources_checked INT NOT NULL DEFAULT 0,
  critical_items INT NOT NULL DEFAULT 0,
  significant_items INT NOT NULL DEFAULT 0,
  monitoring_items INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.briefing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own briefing reports" ON public.briefing_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own briefing reports" ON public.briefing_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own briefing reports" ON public.briefing_reports FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_briefing_profiles_updated_at
BEFORE UPDATE ON public.briefing_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
