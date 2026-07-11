---
tags: [build-log]
date: 2026-07-11
phase: "MVP polish — post Phase 8 (Saved and Profile)"
task: Profile view/edit split (read-only summary + top-right edit toggle)
status: done
---

# 2026-07-11 — Profile View/Edit Split

## Task
The Profile tab felt "all over the place": it stacked a read-only summary card *and* the full
always-editable form on one long scrolling screen. Requested: clean and organized, everything
concise on one screen without scrolling, and editing only via an Edit button in the top-right.

## Scope
- In scope: rework `app/(tabs)/profile.tsx` into a read-only view mode + an edit mode behind a
  top-right pencil button; extend the shared `ScreenHeader` with a trailing `action` slot.
- Explicitly out of scope: profile data model, onboarding wizard, saved resources, other tabs.

## Changes
| File | Change | New? (approved?) |
|------|--------|------------------|
| app/(tabs)/profile.tsx | View/edit split. View: `ScreenHeader` (title + subtitle + pencil `HeaderButton`), avatar hero, one info card (ZIP · radius · document names via `documentsSummary`), bottom-pinned Reset link + privacy note. Edit: existing form sections + Save (try/catch/finally with a failure alert) + X cancel with a dirty-check "Discard changes?" confirm. Removed the duplicated summary-over-form layout and the `justSaved` timer. | edited |
| src/components/ScreenHeader.tsx | Optional `action?: ReactNode` trailing slot (title row becomes space-between); backwards compatible with all existing callers. | edited |
| docs/obsidian/02 Design/UI Design System.md | Codified danger red = emergencies **plus confirmed destructive actions** (code and doc previously disagreed re: "Reset setup"). | edited |

## Quality checks
- typecheck: pass (`tsc --noEmit`)
- lint: pass (`eslint .`)
- test: n-a (placeholder script)
- manual run: not exercised on device this session — needs a sim/device tap-through (see risks)

## Reviews
- qa-tester: **PASS.** Hooks order, state sync, save/cancel/reset routing all correct. Flagged: missing
  try/finally on save (fixed), font-scaling overflow risk in the non-scroll view (fixed via scroll),
  web-only `Alert.alert` no-op on Reset (noted, web is CI-only), legacy no-ZIP profiles must enter a
  ZIP before saving any edit (accepted, matches setup requirements).
- ui-reviewer: **31/40 — needs revision → all P1/P2s fixed in-task.** P1 font-scaling clip → view mode
  now scrolls with `flexGrow: 1` (reset link stays bottom-pinned when content fits). P1 header
  divergence → `ScreenHeader` gained an `action` slot; Profile now uses the shared header + subtitle
  like other tabs. P2 silent discard → dirty-check confirm on X. P2 save failure → alert + draft kept.
  P2 "2 of 6" recall issue → document names shown ("DD-214, VA card +1 more").

## Logs updated
- [x] app_walkthrough → [[app_walkthrough]] (Profile section updated)
- [x] decision log → n-a (design-doc clarification logged in the table above, not a product decision)
- [ ] bug log → n-a
- [x] Command Center current/next task

## Risks / follow-ups
- Needs an on-device pass: view↔edit toggle, discard confirm, large-text scrolling, reset flow.
- VoiceOver gets no announcement when the screen swaps view↔edit (full content replace).
- `Alert.alert` (reset + discard confirms) is a no-op on react-native-web — irrelevant unless web
  becomes a real target.
- Discover/Map still use their own top-bar pattern; they could adopt the `ScreenHeader` `action`
  slot later to converge all tabs.

## Next step
- On-device QA of the overhaul + this profile rework (see Command Center).
