-- Frontline — retire the individual VSO-representative rows.
--
-- The `vso-representatives` provider held 7,759 rows, each one an individual
-- accredited person: "VSO Rep — Aakeem Robinson", pinned to a ZIP centroid with
-- no street address, and 2,389 of them with no phone at all. It was the entire
-- `legal` category. For a veteran that is a phone book of strangers rather than
-- somewhere to go, so it is replaced by `vso-organizations`, which rolls VA
-- OGC's accredited-ORGANIZATION export up to ~7,200 rows naming an organization
-- a veteran recognises (American Legion, VFW, DAV, their state department of
-- veterans affairs, or their County Veterans Service Officer) and a town near
-- them.
--
-- The ids differ between the two providers, so the old rows cannot be updated in
-- place — they would simply be stranded. Delete them; the replacement source
-- repopulates `legal` and also fills `benefits_help`.
--
-- OPERATIONAL NOTE: run the replacement immediately after this migration.
--
--     node --experimental-strip-types ingestion/run.ts --source vso-organizations
--
-- Between the two steps `legal` is empty and the freshness gate will fail CI for
-- a provider that no longer exists — that is expected. The same caveats as 0023
-- apply: `resource_votes` cascades, and on-device saved ids pointing at these
-- rows will stop resolving.

begin;

-- resource_sources.resource_id is `on delete set null` (0008), so clear the
-- lineage rows explicitly rather than leaving 7,759 orphans behind.
delete from public.resource_sources
where provider = 'vso-representatives';

delete from public.resources
where source_provider = 'vso-representatives';

commit;
