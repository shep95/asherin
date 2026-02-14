
-- Add response_depth to user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS response_depth text NOT NULL DEFAULT 'standard';

-- Create calibration_feedback table for the Calibration Loop
CREATE TABLE public.calibration_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  message_id uuid NOT NULL,
  feedback text NOT NULL, -- 'perfect', 'too_shallow', 'too_deep', 'missed_point', 'factually_wrong'
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.calibration_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own calibration feedback"
ON public.calibration_feedback
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create user_intelligence_profile for behavioral inference
CREATE TABLE public.user_intelligence_profile (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  inferred_traits jsonb NOT NULL DEFAULT '{}',
  tone_preference text NOT NULL DEFAULT 'neutral', -- 'direct', 'friendly', 'formal', 'neutral'
  depth_auto text NOT NULL DEFAULT 'standard',
  topics_of_interest text[] NOT NULL DEFAULT '{}',
  active_hours text[] NOT NULL DEFAULT '{}',
  total_calibrations integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_intelligence_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own intelligence profile"
ON public.user_intelligence_profile
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Auto-create intelligence profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  INSERT INTO public.usage_stats (user_id) VALUES (NEW.id);
  INSERT INTO public.user_intelligence_profile (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$function$;

-- Trigger to update updated_at on intelligence profile
CREATE TRIGGER update_user_intelligence_profile_updated_at
BEFORE UPDATE ON public.user_intelligence_profile
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
