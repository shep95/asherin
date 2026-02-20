
-- Tracker: devices and locations tables
CREATE TABLE IF NOT EXISTS public.tracker_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_name TEXT NOT NULL DEFAULT 'Unnamed Device',
  pairing_token TEXT UNIQUE,
  pairing_token_expires_at TIMESTAMP WITH TIME ZONE,
  last_seen TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tracker_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own tracker_devices"
ON public.tracker_devices FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.tracker_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.tracker_devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  accuracy DECIMAL(5,2),
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tracker_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own tracker_locations"
ON public.tracker_locations FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
