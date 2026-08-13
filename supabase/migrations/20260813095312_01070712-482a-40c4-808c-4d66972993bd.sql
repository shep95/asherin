-- houseofasher_applications: an authenticated user could INSERT arbitrary rows
-- with no owner binding, no volume ceiling, and could pre-set the decision
-- fields the analyzer is supposed to write. Bind every row to its submitter.

ALTER TABLE public.houseofasher_applications
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- Sanity ceilings so a row cannot be used as a free blob store.
ALTER TABLE public.houseofasher_applications
  DROP CONSTRAINT IF EXISTS houseofasher_applications_field_bounds;
ALTER TABLE public.houseofasher_applications
  ADD CONSTRAINT houseofasher_applications_field_bounds CHECK (
    char_length(company_name) BETWEEN 1 AND 200
    AND char_length(founder_name) BETWEEN 1 AND 200
    AND char_length(founder_email) BETWEEN 3 AND 320
    AND (website IS NULL OR char_length(website) <= 500)
    AND pg_column_size(answers) <= 65536
  );

-- One open application per submitter: blocks bulk insert loops outright.
CREATE UNIQUE INDEX IF NOT EXISTS houseofasher_applications_one_open_per_user
  ON public.houseofasher_applications(submitted_by)
  WHERE submitted_by IS NOT NULL AND status IN ('pending', 'analyzing');

DROP POLICY IF EXISTS "Authenticated can submit application" ON public.houseofasher_applications;
CREATE POLICY "Submitter inserts own application"
  ON public.houseofasher_applications FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND status = 'pending'
    AND decision IS NULL
    AND analysis IS NULL
    AND composite_score IS NULL
    AND success_probability IS NULL
    AND rejection_reason IS NULL
  );

-- A submitter may read the application they filed. Verdict fields stay
-- analyzer-written; the submitter still cannot update or delete the row.
DROP POLICY IF EXISTS "Submitter views own application" ON public.houseofasher_applications;
CREATE POLICY "Submitter views own application"
  ON public.houseofasher_applications FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

GRANT SELECT, INSERT ON public.houseofasher_applications TO authenticated;
GRANT ALL ON public.houseofasher_applications TO service_role;