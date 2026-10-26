-- Frontline — the `food` category was half not food. Prove it or drop it.
--
-- WHAT WAS IN THERE
--
-- Reported by the user, who opened Essentials and found senior living homes. The
-- audit that followed was worse than the complaint. Of 127,671 rows in `food`:
--
--   10,928  HUD Section 202 subsidised senior APARTMENT buildings
--           ("Rent typically 30% of adjusted income. 29 units. Apply via
--            property management; waiting lists common.")
--   10,882  Medicare-certified home health agencies
--    5,997  HOSPICE providers — end-of-life care
--    5,421  federally-certified rural health clinics
--    2,346  community clinics
--    1,493  Department of Veterans Affairs facilities (Vet Centers, CBOCs)
--      892  intermediate care facilities for the developmentally disabled
--           plus dialysis centres, Ryan White HIV providers, Indian Health Service
--
-- A veteran searching for a meal was being shown a hospice.
--
-- WHY THE PREVIOUS APPROACH COULD NEVER WORK
--
-- This is the FOURTH distinct class of non-food to reach this category:
--
--   0023/0025  school cafeterias (51,839 rows, 44% of the category)
--   0023       SAMHSA behavioural-health facilities carrying a food taxonomy
--   0032/0033  SNAP retailers — Subway, Walmart, KFC franchise numbers
--   0034       this: housing, home health, hospice, clinics
--
-- Each was fixed by excluding the bad class once discovered. That approach cannot
-- finish, because the premise is wrong: feedam.org is not a food feed. It is a
-- general health-and-human-services aggregator whose food taxonomies are attached
-- to things that are not food, and no exclusion list can anticipate the next class.
--
-- So the adapter now INVERTS the test. `isProvenFoodSite` requires the feed's own
-- service text to say the place does food, and rejects anything carrying a clinical
-- or housing class marker even when it does. Dialysis centres are the reason both
-- halves are needed — their text mentions a renal *diet*, so positive evidence
-- alone lets them through.
--
-- SANITY CHECK ON THE RESULT
--
-- This removes roughly half the category. The survivors — about 61,000 — match
-- Feeding America's own published network size of ~60,000 pantries and meal
-- programmes. The 127,671 figure was never a count of food sites, and every
-- "~130k resources" claim built on it was inflated by things a hungry veteran
-- cannot eat at.

delete from public.resources
where category = 'food'
  and source_provider = 'feed-america'
  and not (
    -- must say it does food...
    (name || ' ' || coalesce(eligibility, '')) ~* '\m(foods?|meals?|pantr(y|ies)|grocer\w*|produce|hunger|harvest|commodit\w*|soup kitchen|congregate dining|WIC|SNAP|nutrition assistance|feeding)\M'
    -- ...and must not be a clinical or housing facility that merely mentions it
    and (name || ' ' || coalesce(eligibility, '')) !~* '\m(home health|hospice|rural health clinic|federally.certified rural|HUD Section|Rent typically|apply via property management|LIHTC|Medicare.certified|intermediate care facility|Ryan White|Indian Health Service|Department of Veterans Affairs facility|dialysis|end.stage renal|skilled nursing|assisted living|opioid treatment|methadone|buprenorphine|naltrexone|medication.assisted|substance use disorder|detox|psychiatric|mental health treatment facility)\M'
  );
