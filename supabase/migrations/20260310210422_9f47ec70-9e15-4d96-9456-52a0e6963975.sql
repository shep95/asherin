
-- Create vedic-knowledge storage bucket (private, only edge functions access it)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vedic-knowledge', 'vedic-knowledge', false)
ON CONFLICT (id) DO NOTHING;
