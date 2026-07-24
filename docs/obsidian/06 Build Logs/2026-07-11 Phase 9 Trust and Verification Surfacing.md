---
tags: [build-log]
date: 2026-07-11
phase: "Phase 9 — Trust, Safety & Verification Surfacing"
task: Trust & verification surfacing (disclaimer, crisis routing, trust badge convergence, stale warnings)
status: done
---

# 2026-07-11 — Phase 9 Trust and Verification Surfacing

## Task

Make trust explicit and consistent on every surface per [[Phase 9 Trust and Verification]] and
[[MVP Acceptance Criteria]] §F. An audit showed most trust UI already shipped in Phases 4–8
(source badges + stale detection on cards/detail, AI labels via `AiContentBlock`,
`EmergencyCallBanner`, on-device-only storage); Phase 9 filled the four real gaps.

## Scope

- In scope: persistent "not the VA" disclaimer; category-level crisis routing on Emergency
  results; trust badge on the map pin preview; explicit stale/unverified warning on detail.
- Explicitly out of scope: real verification pipeline, community submissions ([[Non-MVP Ideas]]).

## Changes

| File | Change | New? (approved?) |
|------|--------|------------------|
| `src/components/NavigatorDisclaimer.tsx` | Single source of the required disclaimer copy; quiet caption + info icon | new — approved in plan |
| `src/features/resources/CrisisBanner.tsx` | Emergency-results crisis routing: 911 text-only, tappable "Call 988, then press 1" | new — approved in plan |
| `src/features/resources/SourceRow.tsx` | Shared trust badge row (was duplicated inline in card + detail); `flexShrink` so long labels wrap | new — architect-recommended (replaces 2 duplicates) |
| `src/features/resources/resourceStatus.ts` | `trustWarning()` — hedged amber guidance sentence, same predicate as `sourceStatus` so tone/warning can't disagree | edited |
| `src/features/resources/resourceActions.ts` | `callPhone` catches `tel:` rejection (simulator/iPad/web) and shows the number in an Alert instead of failing silently | edited |
| `src/features/resources/EmergencyCallBanner.tsx` | Extracted shared `DangerCallBanner` shell (used by both banners); title moved to new `dangerText` token (AA fix) | edited |
| `src/features/resources/ResourceCard.tsx` | Inline trust row → `SourceRow` | edited |
| `src/features/resources/ResourceDetail.tsx` | `SourceRow` + `trustWarning` in Trust section; `NavigatorDisclaimer` at page bottom | edited |
| `src/features/resources/ResourcePreview.tsx` | Map pin callout now shows `SourceRow` (was the only badge-less surface) | edited |
| `app/results.tsx` | `CrisisBanner` hoisted above **all** branches (loading/error/empty/list) + map branch; disclaimer in list footer + empty state; map/toggle wrapped so the floating toggle stays anchored to the map | edited |
| `app/(tabs)/home.tsx` | `NavigatorDisclaimer` pinned to bottom (`marginTop: 'auto'`) | edited |
| `src/theme/colors.ts` | `dangerText: '#A93226'` — danger as text, ≥4.5:1 on the tinted banners | edited |
| `src/components/index.ts` | Export `NavigatorDisclaimer` | edited |

## Quality checks

- typecheck: pass (`tsc --noEmit`)
- lint: pass (`eslint .`)
- test: n-a (script is a placeholder; hook skips it)
- manual run: not run this session — ⚠️ needs an on-device pass (see risks)

## Reviews

- ui-reviewer: needs-revision → **all findings fixed in-task**: P1 crisis banner now survives
  loading/error branches; P2 `dangerText` AA token (banner title was 4.20:1, now ~5.7:1);
  P2 banner style duplication → `DangerCallBanner` shell; P2 `SourceRow` `flexShrink`;
  P3s (988 silent-failure Alert, banner spacing, deliberate no-disclaimer-on-map comment).
- qa-tester: **PASS** on all §F criteria with evidence; confirmed tone/warning predicates are
  logically identical, zero-results Emergency still shows the banner, seed data reaches both
  warning wordings, no storage/network regressions.
- /slop-check: **pass** — duplication went down (2 inline trust rows + 2 identical style
  blocks removed), no unrelated changes, no `any`, honest data.

## Logs updated

- [x] app_walkthrough → [[app_walkthrough]] (Phase 9 entry)
- [x] decision log → [[Decision Log]] (911 text-only; SourceRow/DangerCallBanner convergence)
- [ ] bug log — n/a (no bug)
- [x] Command Center current/next task

## Same-day user-feedback trim

- `NavigatorDisclaimer` removed from **Home** (stays on Results + detail — where resources are
  actually shown). `AiContentBlock`'s footer `disclaimer` prop removed everywhere — the
  "AI-generated — verify with the source" tag is each block's one label; `AI_NOT_ADVICE_DISCLAIMER`
  stays in the `AiService` contract (`templatedAiService` still returns it). Verify re-run: green.

## Risks / follow-ups

- The review-fix edits (banner hoist, `dangerText`, `DangerCallBanner` extraction) landed
  *after* the agent reviews; they implement the reviewers' own prescriptions verbatim and
  verify is green, but they haven't had a second agent pass.
- Needs an on-device tap-through: Emergency results (banner above list/map/empty/error; 988
  button; Alert fallback on a device with no dialer), disclaimer placement at large text
  sizes, `SourceRow` wrapping in the narrow map preview.
- The "fresh but unverified" demo resource crosses the 90-day stale line ~2026-07-29 and its
  warning wording flips (still shows a warning either way).
- Splash/app-icon artwork still pre-palette (carried over).

## Next step

- On-device QA pass (this phase + the Phase 4–8 items still flagged ⚠️), then
  [[Phase 10 Backend and Data Ingestion]] planning or splash/app-icon artwork.
