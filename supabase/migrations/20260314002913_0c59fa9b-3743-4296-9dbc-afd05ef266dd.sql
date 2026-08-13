-- HISTORY REDACTION: operator mailboxes that once appeared in this file have been
-- replaced with role labels. These statements already ran; identity is now decided
-- by public.is_internal_staff/is_internal_operator (sha256 digests). Do not
-- re-add an address here — a committed mailbox is a disclosure.

-- Bug reports & feature requests table
CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  type TEXT NOT NULL DEFAULT 'bug' CHECK (type IN ('bug', 'feature')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
CREATE POLICY "Users can insert own reports" ON public.bug_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can view only their own reports
CREATE POLICY "Users can view own reports" ON public.bug_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admin summary sessions table
CREATE TABLE public.bug_report_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  summary TEXT NOT NULL,
  report_ids UUID[] NOT NULL DEFAULT '{}',
  bug_count INT NOT NULL DEFAULT 0,
  feature_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_report_summaries ENABLE ROW LEVEL SECURITY;

-- No public policies - only accessible via service role (edge function)

-- Security definer function for admin to read all reports
CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = _user_id AND email = 'operator-owner@redacted.invalid'
  );
$$;

-- Admin can read all reports
CREATE POLICY "Admin can read all reports" ON public.bug_reports
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

-- Admin can update reports (status changes)
CREATE POLICY "Admin can update reports" ON public.bug_reports
  FOR UPDATE TO authenticated USING (public.is_admin_user(auth.uid()));

-- Admin can read summaries
CREATE POLICY "Admin can read summaries" ON public.bug_report_summaries
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

-- Admin can insert summaries
CREATE POLICY "Admin can insert summaries" ON public.bug_report_summaries
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user(auth.uid()));
