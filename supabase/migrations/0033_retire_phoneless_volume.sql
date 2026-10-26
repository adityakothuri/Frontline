-- Frontline — retire two providers that were volume without utility, and finish
-- the retailer purge that a JS/Postgres regex mismatch let back in.
--
-- THE QUESTION THAT DROVE THIS
--
-- "If I were a veteran, would I really use these?" Asked honestly of each provider,
-- two failed outright.
--
-- 1. `irs-veterans-orgs` — 23,923 rows, **0% with a phone number.**
--
-- These were the IRS register of 501(c)(19) posts and NTEE W30 veterans
-- organizations. The reasoning for adding them was sound: American Legion, VFW and
-- DAV posts are real places where veterans gather, none of the five publishes a
-- usable locator, and the IRS lists every one of them monthly.
--
-- But a BMF address is the *mailing* address the organization filed. For a post
-- that owns a hall it is the hall; for a small chapter it is the treasurer's house.
-- There is no phone in the file, no hours, no website, and — verified — no joinable
-- national source for any of them (ProPublica's API has no phone field; the IRS
-- 990-XML path covers 27% of these EINs at ~16 GB per refresh, and the number there
-- is the bookkeeper's).
--
-- So the row a veteran actually saw was: a name, an address that might be a
-- residence, and no way to check before driving there. That is not a resource, and
-- 23,923 of them were 11% of the catalogue and 75% of `community_support`.
--
-- 2. `usajobs` — 358 rows, **0% with a phone, 0% with a street address.**
--
-- Federal job *postings*: adverts that expire, at city-level coordinates, with no
-- one to call. `careeronestop-ajc` replaced them with 2,169 actual job centres,
-- 1,536 of which have a named veterans' employment representative. Keeping expiring
-- adverts alongside staffed offices only dilutes the category.
--
-- 3. The retailer purge, again.
--
-- 0032 removed 5,438 SNAP retailers from `food` (Subway # 42247, WALMART #5663,
-- Great Am Chicken Corp dba KFC E791005). 507 returned on the next re-ingest,
-- because the adapter's guard used **Postgres** word boundaries (`\m`, `\M`) inside
-- a **JavaScript** regex, where they are identity escapes for the letters m and M —
-- so it matched nothing while the SQL in 0032 worked perfectly. Two regex dialects
-- in one feature. `isCommercialVenue` now uses `\b`, covers bare store numbers
-- (`Subway 20053`, `Kfc K312047`), and is pinned by 28 tests built from the real
-- names that got through.
--
-- Both retired providers are also removed from `ingestion/run.ts`, `refresh.sh` and
-- `freshnessGate.ts` in the same change — deleting rows alone would have let the
-- next monthly cron put them straight back.

delete from public.resources where source_provider in ('irs-veterans-orgs', 'usajobs');

-- The 507 that came back, plus bare store numbers the 0032 pattern missed.
delete from public.resources
where category = 'food'
  and source_provider = 'feed-america'
  and (
    name ~* '\mdba\M'
    or name ~ '#\s*\d{2,}'
    or name ~ '\m[A-Za-z]?\d{4,}\M'
    or name ~* '\m(kfc|mcdonald''s|subway|starbucks|domino''s|pizza hut|taco bell|wendy''s|burger king|chipotle|dunkin|panera|popeyes|chick[- ]?fil[- ]?a|little caesars|papa john''s|jack in the box|sonic drive|arby''s|hardee''s|whataburger|culver''s|jimmy john''s|firehouse subs|wingstop|panda express|olive garden|applebee''s|denny''s|ihop|waffle house|7[- ]?eleven|walmart|kroger|safeway|costco|dollar general|dollar tree|family dollar|cvs|walgreens|rite aid|circle k|speedway|wawa|sheetz|aldi|publix|winn[- ]?dixie|trader joe''s|whole foods)\M'
  );
