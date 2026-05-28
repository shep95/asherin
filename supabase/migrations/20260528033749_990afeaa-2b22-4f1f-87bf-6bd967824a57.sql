
CREATE TABLE public.houseofasher_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  founder_name TEXT NOT NULL,
  founder_email TEXT NOT NULL,
  website TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  decision TEXT,
  composite_score NUMERIC,
  success_probability NUMERIC,
  analysis JSONB,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.houseofasher_applications TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.houseofasher_applications TO authenticated;
GRANT ALL ON public.houseofasher_applications TO service_role;

ALTER TABLE public.houseofasher_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit application"
  ON public.houseofasher_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can view applications"
  ON public.houseofasher_applications FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin can update applications"
  ON public.houseofasher_applications FOR UPDATE
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin can delete applications"
  ON public.houseofasher_applications FOR DELETE
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE TRIGGER update_houseofasher_applications_updated_at
  BEFORE UPDATE ON public.houseofasher_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_houseofasher_applications_status ON public.houseofasher_applications(status);
CREATE INDEX idx_houseofasher_applications_created_at ON public.houseofasher_applications(created_at DESC);
