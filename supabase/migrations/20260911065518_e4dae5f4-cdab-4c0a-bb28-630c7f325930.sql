ALTER TABLE public.software_navigation_item
  ADD COLUMN IF NOT EXISTS installation_id uuid REFERENCES public.software_installation(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'installed';

ALTER TABLE public.software_navigation_item
  DROP CONSTRAINT IF EXISTS software_navigation_item_section_check;

ALTER TABLE public.software_navigation_item
  ADD CONSTRAINT software_navigation_item_section_check
  CHECK (section IN ('installed','shared','core'));

CREATE INDEX IF NOT EXISTS software_navigation_item_installation_idx
  ON public.software_navigation_item(installation_id);
