---
tags: [build-log, resources, trust, results]
date: 2026-07-09
status: done
---

# 2026-07-09 — Official Online Sources widget (category page)

Added a supporting **"Official online sources"** widget to each category (Results) page — trusted
online backups beneath the local opportunity finder, which stays the focus. Never a tab or a separate
library.

## Curated data — `src/data/officialSources.ts` (new)
- `OfficialSource { title, sourceName, description, url, trust }`; `SourceTrust =
  'va' | 'federal' | 'state' | 'county' | 'nonprofit'` with `SOURCE_TRUST_LABELS` ("Official VA
  Source", …) and `SOURCE_TRUST_COLORS` (reusing the category palette).
- **`OFFICIAL_SOURCES: Record<NeedCategory, OfficialSource[]>`** — 3–5 authored entries per category
  (12 categories). Prioritizes **VA.gov** section pages (health-care, disability, education,
  careers-employment, housing-assistance, homeless, family-member-benefits, find-forms, accredited
  rep, mentalhealth, veteranscrisisline, caregiver, vetcenter), **federal** (USDA SNAP, HUD, DOL VETS,
  CareerOneStop, StudentAid, 988, SAMHSA, LSC, Military OneSource), **state/county directory pointers**
  (NASDVA, NACVSO), and **verified nonprofits** (DAV, Feeding America, 211, NCHV, Hire Heroes USA,
  Student Veterans of America, Stateside Legal, NVLSP, Elizabeth Dole Foundation). Descriptions are
  original plain-English blurbs; links go to the official sites. `officialSourcesFor(category)` getter.

## Widget — `src/features/resources/OfficialSourcesWidget.tsx` (new)
- Titled section ("Official online sources" + a one-line "trusted backup" note). Each source is a
  `PressableScale` `Card` (`accessibilityRole="link"`) → `Linking.openURL(url)`, showing a **trust
  badge** (tinted pill: shield icon + label, colored by trust), an **open-in-new** glyph, the title,
  the source name, and a 2-line description. Consistent with `ResourceCard`. Returns null if none.

## Wired into Results — `app/results.tsx`
- **List view:** the widget is the `FlatList` **`ListFooterComponent`** — below the local cards, so
  local stays primary.
- **Empty state:** rebuilt as a `ScrollView` with a compact "no local results" message + "Update
  location" + the **same widget** (online backup matters most when local is empty).
- **Map view unchanged** (fullscreen, no widget).

## Checks
- `npm run verify` (typecheck + lint) — **passes clean**. Pure-JS, no data-model/native change.
- App hot-reloaded healthy (new data + widget bundle with no errors).
- ⚠️ The Results widget itself not screenshot-able here (needs a nav tap) — human pass.

## Risks / follow-ups
- On-device: open several categories → scroll below the local cards → the widget shows 3–5
  category-matched cards with correct trust badges; tap one → opens the official site. Force an empty
  category → the widget still appears under the message.
- **State/county are generic directory pointers** (NASDVA/NACVSO) — a later enhancement is to use the
  profile ZIP to deep-link the veteran's actual state office / county VSO.
- Curated static data — verify links periodically; a real verified feed is Phase 10.
- `ui-reviewer` (badge contrast, card hierarchy) + `qa-tester` (every category 3–5 valid; links open;
  empty path) once the session resets.

## Related
[[app_walkthrough]] · [[Decision Log]] · [[Trust Safety and Privacy]] · [[Frontline Command Center]]
