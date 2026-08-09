-- A blank verdict is a failed sweep, not a fact about the place. The code no
-- longer banks these; clear the ones already banked so the cells re-assess.
DELETE FROM public.geo_risk_assessments
WHERE risk_level = 'UNKNOWN'
  AND coalesce(btrim(summary), '') = '';