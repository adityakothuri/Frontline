-- Frontline — school-based health centres are not somewhere an adult veteran can go.
--
-- 2,959 HRSA sites in `healthcare` were clinics inside schools: "Robert Bland Middle
-- School Wellness Center", "Blue Ridge Health - Glenn C Marlow Elementary School".
-- They are real Health Center Program service sites, but they serve the students
-- enrolled at that school — and they carried this adapter's generic eligibility text,
-- "Open to everyone, including veterans not enrolled in VA health care", which for
-- these sites is simply untrue.
--
-- Same reasoning as migration 0025, which retired 51,839 school cafeterias from
-- `food`: Frontline serves older veterans, and a resource they are not eligible to
-- use is worse than no resource, because it costs them the trip to find out.
--
-- `ingestion/sources/hrsaHealthCenters.ts` now rejects them at ingest via
-- SCHOOL_BASED_SITE, so this only clears what earlier runs wrote.
delete from public.resources
where source_provider = 'hrsa-health-centers'
  and name ~* '\m(elementary|middle school|high school|jr\.? high|junior high|head start|preschool|pre-k|daycare|day care|academy|school[- ]based health|school health center)\M';
