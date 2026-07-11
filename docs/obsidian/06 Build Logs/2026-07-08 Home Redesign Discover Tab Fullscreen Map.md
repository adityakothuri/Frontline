---
tags: [build-log, home, discover, map, activity, redesign]
date: 2026-07-08
status: done
---

# 2026-07-08 — Home redesign + Discover tab + fullscreen map + activity feed

A three-part UX redesign, each piece architect-reviewed, implemented, and verified in order.

## Piece 1 — Fullscreen map
The map view in Results is now **edge-to-edge** (the screen itself) instead of a rounded padded
widget, with the List/Map `ViewToggle` floating over it.
- `app/results.tsx` — map view is a full-bleed early return (outside `ScreenContainer` padding) with
  a floating toggle; list view unchanged.
- `src/features/resources/ResourceMap.tsx` — dropped the rounded/`overflow:hidden` root.

## Piece 2 — Discover tab
A new **Discover** bottom tab (order: Home · Discover · Saved · Profile) to browse opportunities
without scrolling the whole category list on Home.
- **New:** `app/(tabs)/discover.tsx` (pinned shell row over an opportunity list, or the full category
  list for "Other"; loading/empty/error); `src/features/discover/CategoryShells.tsx` (All · Food ·
  Clothes · VA Help · Employment · Other over `Chip`, with the SHELLS config inline);
  `src/features/needs/NeedCategoryCard.tsx` (the need-category row **extracted** from `home.tsx`,
  now shared).
- **Modified:** `app/(tabs)/_layout.tsx` (Discover tab, `compass-outline`); `home.tsx` (uses the
  shared card); service layer — added **`listResources(category?)`** to `ResourceService` +
  `mockResourceService` (browse all or one category, no modality/radius filter, sorted by distance;
  extracted a shared `compareByDistanceThenVerification`), and **`resourceToNeedCategory`** in
  `needMapping.ts` (re-exported) so browse-**All** cards thread a NeedCategory to detail.

## Piece 3 — Personalized Home + activity/rating feed
Home is now a personal landing: **"Good [time], [name]"** + a **random** daily sub-message + a
**"How was ___?"** review card for the most recent opportunity you engaged with (👍/👎), or
"Nothing to see here" + an **Explore help** button → Discover. The 12-category grid moved to Discover.
- **New:** `src/types/activity.ts`; `src/lib/homeMessages.ts` (stable-per-day picker) +
  `src/lib/ratings.ts` (**deterministic simulated** rating from resource id — no data-model change);
  `src/services/activity/{activityStorage,ActivityContext,index}` (one on-device store mirroring
  `profile`: engagements + ratings, versioned key `frontline.activity.v1`, tolerant load → empty
  shape, dedupe-by-resource + cap 20); `src/features/home/ReviewPrompt.tsx`.
- **Modified:** `app/(tabs)/home.tsx` (thin composition, gated on `isHydrated`; Explore uses
  `router.navigate('/discover')` to switch tabs); `app/_layout.tsx` (`ActivityProvider` inside
  `ProfileProvider`); `src/features/resources/ResourceDetail.tsx` (records `'viewed'` on open and
  `'called'`/`'directions'` on the footer actions; shows the labeled simulated rating in Trust).

## Honesty & privacy
The community rating is **always labeled "simulated (demo)"** and the veteran's own 👍/👎 is a
**separate fact** — never blended into a fake average (architect guardrail). Engagement + ratings are
**on-device only**, nothing sensitive — consistent with Privacy-by-default. `resourceActions.ts` and
`ResourceCard.tsx` stayed pure/untouched; recording lives at the detail call sites. All three pieces
pre-approved by `react-native-architect`.

## Checks
- `npm run verify` (typecheck + lint) — **passes clean** after each piece and at the end.
- iOS Simulator (dev client) — **bundles cleanly**; the new **Home renders** (Fraunces greeting +
  random message + sparkles "Nothing to see here" empty state), confirming Piece 3's wiring +
  `homeMessages` picker + hydration gate at runtime.
- ⚠️ Interactive tap-through of Discover + the fullscreen map + the 👍/👎 loop **not automatable
  here** (no sim tap tooling; macOS blocks synthetic input) — needs a human pass (see risks).

## Risks / follow-ups
- On-device: verify the fullscreen map + floating toggle; Discover shells filter + "Other" grid;
  open a resource → Home shows the "How was X?" card → 👍/👎 advances it; empty Home → Explore →
  Discover tab (not a stacked push).
- The simulated-rating "simulated (demo)" label placement is the top item for `ui-reviewer`/
  `qa-tester` (honesty rule).
- `ui-reviewer` + `qa-tester` still to run once the account session limit resets.

## Follow-up refinements (same day, on user feedback)

- **Shell resize bug fixed** — selecting a shell made the row balloon (a horizontal `ScrollView`
  stretching vertically on re-render). Fixed in `CategoryShells.tsx` (`scroll: { flexGrow: 0 }` +
  `row: { alignItems: 'center' }`) and `discover.tsx` (content wrapped in a `flex: 1` view) so the
  row keeps its natural height.
- **Location control** — new `src/components/LocationButton.tsx` (pin + ZIP or "Set location" + a
  caret), placed **top-left** on Home and Discover; tap → the Profile tab to change it (ZIP is set at
  onboarding, always changeable). Currently display + edit-shortcut; later it will scope results by
  ZIP. *(One new shared component, added on direct user request.)*
- **Shell icons** — each Discover shell now carries an icon (All apps · Food · Clothes · VA Help doc ·
  Employment briefcase · Other ellipsis).
- **Miscellaneous** — the "Other" category list gains a **Miscellaneous** entry for API items that
  don't fit a rigid category; since the mock has none, it shows **"Nothing here yet."** Empty category
  browses use the same "Nothing here yet" copy.
- Verified: `npm run verify` green; the app bundles (1204 modules) and Home renders the location pill
  + the working "How was X?" review card (labeled "simulated (demo)").

### Dedicated Map tab + spacing pass (on user feedback — "I don't see a map anywhere")
- **Map tab** — the map was buried (Discover → Other → category → Results → toggle). Added
  `app/(tabs)/map.tsx`: a full map of **all** located opportunities via `listResources()`, reusing
  `ResourceMap` (pins → preview → detail + recenter). Registered in the tab bar → **Home · Discover ·
  Map · Saved · Profile**. `ResourceMap.needCategory` is now optional (derived per-pin via
  `resourceToNeedCategory` on the general tab); the Results List⇄Map toggle stays for category
  searches. Reverses the Phase 5 "no map tab" call — see [[Decision Log]].
- **Spacing** — `ui-reviewer`-checked pass across Home/Discover/Map: uniform `xl` gutter and `lg` top
  inset on all three; Discover's shell row now groups with its list (chips→list `sm`, header→chips
  `md`); Map topBar bottom aligned to `md`; subtitle `marginTop` `sm` on the landing screens. Review
  verdict was "PASSES" with the two small fixes now applied. Pure-JS, `npm run verify` green.

## Related
[[app_walkthrough]] · [[Decision Log]] · [[Screens List]] · [[Frontline Command Center]] ·
[[Phase 5 Map and Discovery]] · [[Phase 8 Saved and Profile]]
