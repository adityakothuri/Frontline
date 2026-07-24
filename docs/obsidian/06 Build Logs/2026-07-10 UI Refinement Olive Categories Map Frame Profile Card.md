---
tags: [build-log, design-system, resources, map, profile]
date: 2026-07-10
phase: "Polish — post-Phase-8 UI refinement"
task: Single call script, olive category palette, framed Map tab, reorganized Profile
status: done
---

# 2026-07-10 — UI refinement: olive categories, single call script, framed map, profile card

Follow-up polish pass from on-device feedback after the Granola/olive overhaul
([[2026-07-10 Granola UI Overhaul Olive Accent Action Row Call Script Sheet]]). No new files, no
new dependencies.

## Task
User feedback, five items: (1) one call script option, not multiple; (2) less AI-sounding copy —
"Plain-English summary" → "Summary"; (3) Discover's "Other" grid looked like a different app —
keep the olive scheme, colorful but in-family; (4) the Map tab butted straight against the top bar
and tab bar — add buffer and "make it look like a proper app"; (5) Profile felt scattered — add a
profile-picture area and one organized place for the info, more olive.

## Changes
| File | Change | New? |
|------|--------|------|
| `src/features/resources/CallScriptCard.tsx` | Tone toggle removed — one script per resource; tone now a prop (`standard`, emergency passes `short`); failed state is a tap-to-retry row | edited |
| `src/features/resources/CallScriptSheet.tsx` | `initialTone` → `tone`, passthrough | edited |
| `src/features/resources/ResourceDetail.tsx` | Passes `tone`; AI block title "Plain-English summary" → "Summary" | edited |
| `src/types/need.ts` | 12 category colors → olive/earth family (olives, sages, ochres, warm browns; emergency rust) | edited |
| `src/types/resource.ts` | Same palette, matched per category; sync note added | edited |
| `app/(tabs)/map.tsx` | Header (title + subtitle) above a **framed, rounded map card** with margins; status strip below ("N places on the map — tap a pin to preview") | edited |
| `src/features/resources/ResourceMap.tsx` | Stale "edge-to-edge" comment updated (component fills its container) | edited |
| `app/(tabs)/profile.tsx` | Reorganized: centered avatar with olive ring → **at-a-glance info card** (role / ZIP / radius / documents, olive icon chips, hairline dividers) → form sections with olive section icons | edited |

## Quality checks
- typecheck: pass (`npm run verify`)
- lint: pass
- test: n/a (no test script)
- manual run: not yet exercised on device — see risks

## Reviews
- ui-reviewer / qa-tester / /slop-check: not run this session (small follow-up pass; run before the
  next milestone close)

## Logs updated
- [x] app_walkthrough → [[app_walkthrough]]
- [x] decision log → [[Decision Log]] ("Category colors move into the olive/earth family; call script is one script")
- [ ] bug log — n/a
- [ ] Command Center — phase unchanged

## Risks / follow-ups
- Twelve colors inside one family are close by design — verify on device that neighboring category
  chips still read distinct (icons + labels carry most of the coding now).
- Map frame: check the rounded corners against the native map on Android (overflow clipping).
- Results screen map is still fullscreen by design; only the Map tab is framed.

## Next step
- On-device tap-through of Discover "Other" grid, Map tab, Profile, and the call-script sheet.
