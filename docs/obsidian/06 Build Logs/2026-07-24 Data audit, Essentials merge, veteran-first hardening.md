---
tags: [build-log]
date: 2026-07-24
phase: "Phase 10 — Backend and Data Ingestion"
task: Data audit + Essentials category merge + veteran-relevance & freshness hardening
status: done
---

# 2026-07-24 — Data audit, Essentials merge, veteran-first hardening

## Task
Full audit of the data that feeds the app, then: (1) merge the **Food** and **Clothing** categories
into one, (2) confirm all data is refreshed periodically so it stays relevant, and (3) keep the data
veteran-niche (no general/unrelated data) while still maintaining lots of data per category.

## Audit findings (the "make sure it's perfect" part)
- **Already veteran-first, enforced.** `veteran_relevance` is NOT NULL + CHECK-constrained
  (`migrations 0011`–`0014`); `search_resources` fills each category cap with veteran rows first
  (`0021_...sql:91`, general sorts last); the UI badges "For veterans" vs "Open to everyone".
- **No genuinely off-niche data.** The only `general` rows are two intentionally-kept datasets —
  Feeding America food (~116.5k) and HUD housing counseling (~1.3k) — both veteran-relevant needs,
  kept by the [[2026-07-24 Data cycle final audit and hybrid rebuild]] decision.
- **Periodic refresh already exists and is proven working.** Ingestion pipeline (`ingestion/`) →
  Supabase, GitHub Actions cron (jobs weekly / places monthly) + `freshnessGate.ts`. Verified live:
  all 5 secrets set, last `workflow_dispatch` run on `main` succeeded (~29m), and **every provider
  has `last_checked = 2026-07-24`** (va-facilities, va-gi-bill, feed-america, hud, usajobs, vso).
- **Resolved a stale blocker:** the Command Center listed "VA key rejected (401)". Live test today:
  the sandbox key returns **200 with the full national set** (health 1,399 / benefits 444 /
  vet_center 417 — matches the live table). The workflow already defaults the VA base URL to sandbox
  to match the sandbox key (`refresh-data.yml:52`). VA ingestion is healthy; blocker cleared.

## Scope
- In scope: need-level merge of Food+Clothing → **Essentials**; cap the general HUD housing dataset
  like food; verify (not rebuild) veteran-first ranking + freshness pipeline; refresh stale docs.
- Out of scope: no DB migration, no destructive row changes, no new app files. Resource categories
  `food`/`clothing` stay separate in the DB. No purge of general data (would gut Food/Housing).

## Changes
| File | Change | New? (approved?) |
|------|--------|------------------|
| `src/types/need.ts` | `NeedCategory` 12→11: `food`+`clothing` → `essentials` (union, META, order); comment fix | edited |
| `src/services/resources/needMapping.ts` | `essentials → ['food','clothing']`; both resource cats → `essentials`; count comment | edited |
| `src/data/officialSources.ts` | merged food+clothing link blocks into one `essentials` block, de-duped 211 | edited |
| `src/features/discover/CategoryShells.tsx` | one `essentials` shell (basket-outline) replaces `food`+`clothes` | edited |
| `src/types/resource.ts` | comment: food/clothing resource cats roll up to the `essentials` need | edited |
| `src/services/resources/supabaseResourceService.ts` | `DENSE_GENERAL_CAPS = { food: 20, housing: 20 }` (cap general HUD) | edited |
| `ingestion/run.ts` | comment: VA sandbox mirrors real public facility data; key is sandbox-scoped | edited |
| `ingestion/README.md` | HUD cap noted; general-sources block rewritten; sandbox-is-correct prerequisite | edited |
| `docs/obsidian/03 Technical/Resource Data Model.md` | de-stale: live Supabase+ingestion (not mock), `veteran_relevance`, Essentials, caps | edited |

## Quality checks
- typecheck: **pass** (`tsc --noEmit`)
- lint: **pass** (`eslint .`)
- test: n-a (placeholder script)
- manual: verified live VA API (sandbox 200 / prod 401), sandbox national counts, live per-provider
  `last_checked`, GitHub secrets set, and the successful dispatch run. Did not launch the RN app this
  session (change is type/mapping-level; exhaustive `Record<NeedCategory>` maps make tsc the gate).

## Reviews
- qa-tester: **PASS** — merge consistent across all layers, HUD cap only drops `general` rows
  (veteran SSVF safe) in both search + browse, no persisted `NeedCategory` to break; flagged two
  stale "12" comments (fixed).
- ui-reviewer: **Ship** — `basket-outline` + ochre `#A56E24` sit in the olive/earth palette; official
  sources de-duped and well-ordered; card-level Food/Clothing chips still show (good granularity).

## Logs updated
- [x] app_walkthrough → [[app_walkthrough]] (Essentials merge + HUD cap entry)
- [x] decision log → [[Decision Log]] (Essentials merge; HUD cap; VA sandbox-is-authoritative)
- [ ] bug log — n/a (no bug; resolved a stale doc-blocker)
- [x] Command Center current/next task

## Risks / follow-ups
- **Production VA data** would need a separately-provisioned production key (current key is
  sandbox-scoped). Not needed today — sandbox is the complete public facility set — but note it if
  the VA ever gates facility data behind production.
- **`.env.seed` holds live secrets on disk** (git-ignored). Service-role key is powerful; rotating
  it is a separate decision, surfaced to the user.
- The `essentials` need spans two resource categories, so its result list interleaves food (capped
  ~20) + clothing (currently 1 referral). If a real clothing dataset is added later, no code change
  is needed — it already maps in.

## Next step
Commit on `feature/essentials-merge-data-hardening` and open a PR (user to approve). No further data
work required — the audit confirms the app is veteran-first, richly populated, and auto-refreshing.
