
-- Predictions table
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.asha_sessions(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  event_type TEXT NOT NULL,
  prediction_text TEXT NOT NULL,
  confidence DECIMAL(4,2) NOT NULL,
  severity TEXT NOT NULL,
  time_horizon TEXT NOT NULL,
  estimated_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  outcome TEXT,
  outcome_date TIMESTAMPTZ,
  signals JSONB NOT NULL DEFAULT '[]',
  reasoning_chain JSONB NOT NULL DEFAULT '[]',
  historical_comparison JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signals table
CREATE TABLE public.prediction_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES public.predictions(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal_category TEXT NOT NULL,
  search_query TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_snippet TEXT NOT NULL,
  source_date TIMESTAMPTZ,
  source_domain TEXT,
  relevance_score DECIMAL(4,2) NOT NULL,
  credibility_score DECIMAL(4,2) NOT NULL,
  weight DECIMAL(4,2) NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historical events table
CREATE TABLE public.prediction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_description TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  was_predicted BOOLEAN NOT NULL DEFAULT false,
  prediction_confidence DECIMAL(4,2),
  prediction_made_at TIMESTAMPTZ,
  lead_time_days INTEGER,
  signals_detected JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signal definitions table
CREATE TABLE public.signal_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  signal_name TEXT NOT NULL,
  search_queries TEXT[] NOT NULL,
  keywords TEXT[] NOT NULL,
  exclude_keywords TEXT[],
  base_weight DECIMAL(4,2) NOT NULL,
  detection_frequency TEXT NOT NULL,
  accuracy_rate DECIMAL(4,2),
  false_positive_rate DECIMAL(4,2),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_predictions_session ON public.predictions(session_id);
CREATE INDEX idx_predictions_status ON public.predictions(status);
CREATE INDEX idx_predictions_confidence ON public.predictions(confidence DESC);
CREATE INDEX idx_predictions_user ON public.predictions(user_id);
CREATE INDEX idx_signals_prediction ON public.prediction_signals(prediction_id);
CREATE INDEX idx_signals_type ON public.prediction_signals(signal_type);
CREATE INDEX idx_history_event_type ON public.prediction_history(event_type);
CREATE INDEX idx_history_date ON public.prediction_history(event_date);

-- RLS
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own predictions"
  ON public.predictions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view signals for own predictions"
  ON public.prediction_signals FOR SELECT
  USING (prediction_id IN (SELECT id FROM public.predictions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert signals for own predictions"
  ON public.prediction_signals FOR INSERT
  WITH CHECK (prediction_id IN (SELECT id FROM public.predictions WHERE user_id = auth.uid()));

CREATE POLICY "All users can read history"
  ON public.prediction_history FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert history"
  ON public.prediction_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All users can read signal definitions"
  ON public.signal_definitions FOR SELECT
  USING (enabled = true);

-- Seed signal definitions
INSERT INTO public.signal_definitions (event_type, signal_type, signal_name, search_queries, keywords, base_weight, detection_frequency) VALUES
('regulatory_action', 'cid_issuance', 'Civil Investigative Demands', ARRAY['{company} "civil investigative demand"', '{company} CID government investigation'], ARRAY['cid', 'subpoena', 'investigation', 'probe', 'inquiry'], 0.40, 'daily'),
('regulatory_action', 'congressional_hearing', 'Congressional Hearings', ARRAY['{company} congressional hearing scheduled', '{company} Senate testimony'], ARRAY['hearing', 'testimony', 'congress', 'senate', 'committee'], 0.30, 'daily'),
('regulatory_action', 'agency_statements', 'Agency Public Statements', ARRAY['FTC {company} statement', 'SEC {company} investigation'], ARRAY['ftc', 'sec', 'doj', 'fda', 'epa', 'statement', 'action'], 0.20, 'daily'),
('regulatory_action', 'whistleblower', 'Whistleblower Reports', ARRAY['{company} whistleblower', '{company} employee complaint'], ARRAY['whistleblower', 'complaint', 'leak', 'allegation'], 0.10, 'daily'),
('executive_departure', 'insider_sales', 'Insider Stock Sales', ARRAY['{company} insider stock sale', '{company} form 4 filing'], ARRAY['form 4', 'insider', 'stock sale', 'shares sold'], 0.40, 'daily'),
('executive_departure', 'linkedin_activity', 'LinkedIn Profile Changes', ARRAY['{company} executive linkedin profile update'], ARRAY['linkedin', 'profile', 'connections', 'activity'], 0.20, 'weekly'),
('executive_departure', 'sentiment_analysis', 'Earnings Call Sentiment', ARRAY['{company} earnings call transcript', '{company} executive earnings statement'], ARRAY['earnings', 'transcript', 'guidance'], 0.30, 'weekly'),
('executive_departure', 'board_meetings', 'Unscheduled Board Activity', ARRAY['{company} emergency board meeting', '{company} special board session'], ARRAY['emergency', 'special session', 'unscheduled', 'urgent'], 0.10, 'daily'),
('earnings_surprise', 'web_traffic', 'Website Traffic Trends', ARRAY['{company} website traffic increase', '{company} user growth'], ARRAY['traffic', 'visitors', 'downloads', 'growth', 'users'], 0.35, 'weekly'),
('earnings_surprise', 'hiring_velocity', 'Hiring Activity', ARRAY['{company} hiring', '{company} job openings'], ARRAY['hiring', 'jobs', 'openings', 'recruiting', 'positions'], 0.25, 'weekly'),
('earnings_surprise', 'supplier_orders', 'Supply Chain Signals', ARRAY['{company} supplier orders', '{company} chip orders production'], ARRAY['supplier', 'orders', 'components', 'production', 'inventory'], 0.20, 'weekly'),
('earnings_surprise', 'product_launches', 'Product Announcements', ARRAY['{company} product launch announcement', '{company} new product release'], ARRAY['launch', 'release', 'announcement', 'unveil', 'introduce'], 0.20, 'daily'),
('product_launch', 'patent_filings', 'Patent Activity', ARRAY['{company} patent filing', '{company} patent application'], ARRAY['patent', 'filing', 'application', 'trademark'], 0.30, 'weekly'),
('product_launch', 'fcc_filings', 'FCC/Regulatory Filings', ARRAY['{company} FCC filing', '{company} regulatory approval'], ARRAY['fcc', 'certification', 'approval', 'filing'], 0.35, 'daily'),
('product_launch', 'leaks_rumors', 'Leaks and Rumors', ARRAY['{company} leaked product', '{company} rumor upcoming'], ARRAY['leak', 'rumor', 'upcoming', 'spotted', 'prototype'], 0.20, 'daily'),
('acquisition_target', 'advisor_hiring', 'Investment Banker Hiring', ARRAY['{company} hires investment bank advisor', '{company} Goldman Sachs Morgan Stanley advisor'], ARRAY['advisor', 'investment bank', 'goldman', 'morgan stanley', 'strategic review'], 0.40, 'weekly'),
('acquisition_target', 'revenue_decline', 'Revenue Decline Signals', ARRAY['{company} revenue decline falling', '{company} restructuring layoffs'], ARRAY['revenue decline', 'restructuring', 'layoffs', 'cost cutting'], 0.25, 'weekly'),
('acquisition_target', 'board_changes', 'Board Composition Changes', ARRAY['{company} board member resignation addition', '{company} new board director'], ARRAY['board', 'director', 'resignation', 'appointed'], 0.20, 'weekly'),
('acquisition_target', 'market_positioning', 'Market Positioning', ARRAY['{company} strategic alternatives', '{company} exploring options sale'], ARRAY['strategic alternatives', 'exploring options', 'sale', 'merger'], 0.15, 'daily');

-- Update trigger
CREATE OR REPLACE FUNCTION public.update_predictions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_predictions_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_predictions_updated_at();
