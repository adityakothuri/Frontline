---
tags: [build-log, phase-8, saved, persistence]
date: 2026-07-08
status: done
---

# 2026-07-08 — Phase 8: Saved resources

The Save feature that was deferred through Phases 4–7. A veteran can now bookmark an opportunity and
find it later in the **Saved** tab. On-device only, resources-only for now. Architect-reviewed. See
[[Phase 8 Saved and Profile]].

## New — `src/services/saved/` (mirrors profile/activity)
- `savedStorage.ts` — AsyncStorage key **`frontline.saved.v1`**, stores `SavedEntry[]`
  (`{ id, savedAt }`, newest-first); tolerant load → `[]`. **IDs only, not snapshots** — so
  trust signals (open-now, last-checked, verification) stay live.
- `SavedContext.tsx` — `SavedProvider` + `useSaved()` → `{ isHydrated, savedIds, isSaved(id),
  toggleSave(id) }`; hydrate-once + persist-on-change, same shape as `ActivityContext`.
- `index.ts` — barrel. `SavedProvider` wrapped **innermost** in `app/_layout.tsx`.

## Save controls
- **`ResourceCard`** — a bookmark toggle in the top-row right cluster (next to the open-now pill),
  `bookmark`/`bookmark-outline`, accent when saved. Reads `useSaved()` directly, so it's correct
  everywhere the card appears (Results, Discover, Saved). No propagation handling needed — RN's
  responder gives the touch to the inner Pressable (same as the card's Call/Directions).
- **Detail** — a **`headerRight`** bookmark on the `/resource/[id]` route's `Stack.Screen` (reads the
  route `id`). `ResourceDetail.tsx` is **unchanged** and the sticky Call · Directions footer stays
  uncluttered.

## Saved tab — `app/(tabs)/saved.tsx`
- `savedIds` is the source of truth for membership + order. An id-keyed `resolved` cache fetches only
  **missing** ids via `resourceService.getById` (parallel), so unsaving from within the tab drops the
  row **instantly, no re-fetch/flash**. Renders `ResourceCard`s (distance shows "Phone / online" —
  no active search origin here), with loading / "Nothing saved yet" states. A `getById` returning
  `null` is filtered out silently.

## Also: Phase 7 marked done
`aiService.summarizeBenefit` (built Phase 4, refined Phase 6) fulfills Phase 7 — full structured,
hedged, labeled summary on the detail page. Roadmap status flipped to done.

## Checks
- `npm run verify` (typecheck + lint) — **passes clean**. **Pure-JS, no native rebuild.**
- App hot-reloaded healthy on the sim.
- ⚠️ Save/unsave/persist + the Saved tab not screenshot-able here (no sim tap tooling) — needs a
  human pass.

## Risks / follow-ups
- On-device: bookmark a resource from a card and from the detail header → it appears in **Saved**;
  unsave → it leaves; reload → saved items persist; empty tab shows the placeholder.
- Saved-tab cards pass `needCategory="general_benefits"` (no original need on this surface) — the
  detail still opens fine (route also falls back to that).
- Later: save other item types (scripts/checklists); the extended optional profile + radius-into-
  queries (the rest of Phase 8).
- `ui-reviewer` (bookmark tap target/affordance) + `qa-tester` once the account session limit resets.

## Related
[[Phase 8 Saved and Profile]] · [[app_walkthrough]] · [[Decision Log]] · [[Frontline Command Center]]
