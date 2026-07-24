---
tags: [build-log]
date: 2026-07-12
phase: "Pre-Phase 10 — backend readiness"
task: Backend-readiness audit + hardening (error states, contract cleanup)
status: done
---

# 2026-07-12 — Backend Readiness Audit and Hardening

## Task

Verify the whole codebase is structured for a painless Phase 10 backend swap, then fix every
gap found. The audit confirmed the seams are real (all data flows through the `ResourceService`
/ `AiService` singletons — one-line swaps; zero UI imports of seeds/mocks; AsyncStorage confined
to the three storage modules; zero `fetch`/env usage anywhere; `.mcp.json` ignored and never
committed). Five gaps found — all "works with the mock, breaks with a network" — all fixed.

## Scope

- In scope: error/retry states on every service consumer that lacked one; removing dead or
  mock-leaking contract surface. No visual redesign, no behavior change on the happy path.
- Out of scope: the actual backend (Phase 10), geocoding, the AI proxy.

## Changes

| File | Change | New? |
|------|--------|------|
| `app/resource/[id].tsx` | `getById` wrapped in try/catch; new `error` state (distinct from `notFound`) renders `ErrorState` with retry | edited |
| `app/(tabs)/saved.tsx` | Resolve chain gained `.catch` + `resolveFailed` state; `ErrorState` with retry (attempt counter re-runs the effect) when nothing could resolve | edited |
| `src/features/resources/ResourceDetail.tsx` | Summary+plan now load via one `Promise.all` with `.catch` → `aiFailed` renders a tap-to-retry card (mirrors `CallScriptCard`); `recordEngagement` split into its own effect so retries never double-count a view | edited |
| `src/types/resource.ts` | Removed dead `ai_summary` field (never read — summaries come from `AiService`) | edited |
| `src/services/resources/seedResources.ts` | Removed the 12 `ai_summary: null` lines | edited |
| `src/services/resources/index.ts` | `SEED_CENTER` no longer exported — the one mock concept is out of the public service API | edited |
| `src/features/resources/ResourceMap.tsx` | First-paint region now derives from the first pinned result (fitToPins refines on ready); wide-US `FALLBACK_REGION` only when no pins exist (map isn't rendered then anyway) | edited |

No new files, no new dependencies.

## Quality checks

- typecheck: pass · lint: pass (`npm run verify`)
- iOS Hermes bundle export: clean before the fixes (2.89 MB, exit 0); re-run after the fixes.
- manual run: not run — error paths are unreachable with the never-throwing mock; they exist
  for the real backend. ⚠️ Simulate by making a service method reject once on device.

## Reviews

- Fixes implement the audit's own findings verbatim; patterns copied from in-repo precedents
  (`useResourceSearch` state machine, `CallScriptCard` failed state). No agent re-review run.

## Logs updated

- [x] Decision log → [[Decision Log]] (contract cleanups)
- [x] Command Center current/next task
- [ ] app_walkthrough — deliberately skipped: no flow, screen, or data-shape change a reader
      would notice; error-state hardening is noted here and in the Decision Log.

## Risks / follow-ups

- Error branches are untested against a real failing service (mock never rejects). When the
  first real `ResourceService`/`AiService` lands, throw once intentionally and eyeball all
  four retry surfaces (detail route, Saved, detail AI card, results — the last already existed).
- `listResources` still measures browse distance from the seed city *inside the mock* — correct
  place for it; the real service replaces it with real origins.

## Next step

- Phase 10 planning (backend + data ingestion, needs explicit approval), or the accumulated
  on-device QA pass first.
