-- Frontline — drop food sites hosted inside schools and childcare centres.
--
-- 0023 removed the child-nutrition *taxonomies* (`school-meals`,
-- `summer-meals`), which took out the school-meal programs. It did not catch
-- sites the feed tags as ordinary pantries that are nonetheless hosted INSIDE a
-- school, a school district office, or a childcare centre — "Kids Café Parkwood
-- Elementary", "H.T. Jaramillo Elementary Head Start", "WINNSBORO ISD",
-- "La Petite Academy". 9,092 of them survived the national re-ingest.
--
-- Whatever the taxonomy says, the venue is a school: many serve enrolled
-- families only, and a veteran in his seventies is not going to walk into an
-- elementary school for groceries. This is the same judgement as the taxonomy
-- cut, applied to the venue.
--
-- Sampled before deleting: every match was a genuine school, school district, or
-- daycare chain — no community pantry was caught. The pattern is deliberately
-- narrow for that reason, and `college` / `university` are NOT matched, because
-- "University Baptist Church" and "College Hill Food Pantry" are real community
-- pantries that must survive.
--
-- `SCHOOL_VENUE` in ingestion/sources/feedAmericaFood.ts applies the same rule at
-- ingest, so this migration is a one-time cleanup of rows already loaded and is a
-- no-op on a database built from scratch.

begin;

-- resource_sources.resource_id is `on delete set null` (0008) — clear the
-- lineage rows explicitly so they don't linger with a null link.
delete from public.resource_sources s
using public.resources r
where s.resource_id = r.id
  and r.source_provider = 'feed-america'
  and r.name ~* '(\yelementary\y|\ymiddle school\y|\yhigh school\y|\yjunior high\y|\ypreschool\y|\ypre-k\y|\yhead start\y|\ykids caf|\ydaycare\y|\yday care\y|\ychild care\y|\ychildcare\y|\yacademy\y|\yschool district\y|\yisd\y)';

delete from public.resources
where source_provider = 'feed-america'
  and name ~* '(\yelementary\y|\ymiddle school\y|\yhigh school\y|\yjunior high\y|\ypreschool\y|\ypre-k\y|\yhead start\y|\ykids caf|\ydaycare\y|\yday care\y|\ychild care\y|\ychildcare\y|\yacademy\y|\yschool district\y|\yisd\y)';

commit;
