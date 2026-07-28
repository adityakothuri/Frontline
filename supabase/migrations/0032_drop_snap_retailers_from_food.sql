-- Frontline — remove SNAP retailers and franchise restaurants from `food`.
--
-- WHY
--
-- A cleanliness sweep on 2026-07-28 asked the only question that matters — would a
-- veteran actually use these? — and found **3,289 rows in the food category that
-- are shops and fast-food franchises**:
--
--   Subway # 42247 · WALMART #5663 · Pizza Hut #26198 · 7-Eleven
--   Great Am Chicken Corp dba KFC E791005 · Dollar General · CVS
--
-- They arrive from the Feed America aggregator, which blends SNAP-accepting
-- retailers into the same taxonomies as pantries. They are unmistakable once
-- looked at: franchise store numbers and `dba` franchisee trading names.
--
-- This is the same failure the first data audit fixed for school cafeterias
-- (0025), and it is worse than a missing row. A veteran who taps **Food** and is
-- shown KFC does not conclude "that one entry is wrong" — they conclude the app is
-- junk, and they are right to. Accepting SNAP is also not food assistance: the
-- category promises somewhere to GET food when you have none, and a veteran
-- already knows where Walmart is.
--
-- `ingestion/sources/feedAmericaFood.ts` now excludes them at ingest via
-- `isCommercialVenue`, so this only clears what previous runs already wrote.
--
-- The match is deliberately conservative about generic food words. A real pantry
-- can be "St Mary's Kitchen" or "The Bread of Life Bakery", so `kitchen`, `bakery`
-- and `deli` are NOT matched on their own — only chain brands, the `dba` marker,
-- and bare franchise store numbers.

delete from public.resources
where category = 'food'
  and source_provider = 'feed-america'
  and (
    name ~* '\m(kfc|mcdonald''?s?|subway|starbucks|domino''?s?|pizza hut|taco bell|wendy''?s?|burger king|chipotle|dunkin|panera|popeyes|chick[- ]?fil[- ]?a|little caesars?|papa john''?s?|jack in the box|sonic drive|arby''?s?|hardee''?s?|whataburger|culver''?s?|jimmy john''?s?|firehouse subs|wingstop|panda express|olive garden|applebee''?s?|denny''?s?|ihop|waffle house|7[- ]?eleven|walmart|target|kroger|safeway|costco|dollar general|dollar tree|family dollar|cvs|walgreens|rite aid|circle k|speedway|wawa|sheetz|aldi|publix|winn[- ]?dixie|trader joe''?s?|whole foods)\M'
    or name ~* '\mdba\M'
    or name ~ '#\s*\d{3,}'
  );
