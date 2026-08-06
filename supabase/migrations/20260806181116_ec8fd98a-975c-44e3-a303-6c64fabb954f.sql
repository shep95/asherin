ALTER TABLE public.asha_datasets ADD COLUMN IF NOT EXISTS domain_profile jsonb;
CREATE INDEX IF NOT EXISTS asha_datasets_domain_pack_idx ON public.asha_datasets ((domain_profile->>'packId'));