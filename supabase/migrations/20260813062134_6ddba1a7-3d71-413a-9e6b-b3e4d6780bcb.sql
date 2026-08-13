INSERT INTO public.plugins (
  id,
  name,
  description,
  category,
  author,
  icon,
  version,
  downloads,
  rating,
  is_premium,
  price_cents
) VALUES (
  'b8f2c1a4-7d3e-4f5a-9b1c-2e8d6a3f0b71',
  'Lovable',
  'Connect your Lovable build environment to Asherin. Trigger AI-assisted edits, invoke Cloud functions, and sync project intelligence from chat.',
  'connector',
  'Asherin',
  '❤️',
  '1.0.0',
  0,
  4.8,
  false,
  0
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  author = EXCLUDED.author,
  icon = EXCLUDED.icon,
  version = EXCLUDED.version,
  is_premium = EXCLUDED.is_premium,
  price_cents = EXCLUDED.price_cents;