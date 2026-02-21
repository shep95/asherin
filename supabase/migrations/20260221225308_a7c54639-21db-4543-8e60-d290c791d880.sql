
-- Materials intelligence database
CREATE TABLE public.zali_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  success_rate NUMERIC DEFAULT 0,
  times_used INTEGER DEFAULT 0,
  avg_cost NUMERIC DEFAULT 0,
  trend TEXT DEFAULT '0%',
  top_use TEXT DEFAULT '',
  failure_mode TEXT DEFAULT '',
  sustainability TEXT DEFAULT 'unknown',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zali_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own materials"
  ON public.zali_materials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own materials"
  ON public.zali_materials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own materials"
  ON public.zali_materials FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own materials"
  ON public.zali_materials FOR DELETE USING (auth.uid() = user_id);

-- Component reuse library
CREATE TABLE public.zali_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  description TEXT DEFAULT '',
  reused INTEGER DEFAULT 0,
  success_rate NUMERIC DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  lead_days INTEGER DEFAULT 0,
  supplier TEXT DEFAULT '',
  compatible_names TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zali_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own components"
  ON public.zali_components FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own components"
  ON public.zali_components FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own components"
  ON public.zali_components FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own components"
  ON public.zali_components FOR DELETE USING (auth.uid() = user_id);

-- Simulation results
CREATE TABLE public.zali_simulation_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL DEFAULT '',
  sim_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zali_simulation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sim results"
  ON public.zali_simulation_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sim results"
  ON public.zali_simulation_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sim results"
  ON public.zali_simulation_results FOR DELETE USING (auth.uid() = user_id);

-- Manufacturing verification results
CREATE TABLE public.zali_mfg_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL DEFAULT '',
  analysis_type TEXT NOT NULL DEFAULT 'dfm',
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zali_mfg_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mfg results"
  ON public.zali_mfg_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own mfg results"
  ON public.zali_mfg_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own mfg results"
  ON public.zali_mfg_results FOR DELETE USING (auth.uid() = user_id);

-- Optimization results
CREATE TABLE public.zali_optimization_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL DEFAULT '',
  weights JSONB DEFAULT '{}',
  results JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zali_optimization_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own opt results"
  ON public.zali_optimization_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own opt results"
  ON public.zali_optimization_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own opt results"
  ON public.zali_optimization_results FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_zali_materials_updated_at
  BEFORE UPDATE ON public.zali_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zali_components_updated_at
  BEFORE UPDATE ON public.zali_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
