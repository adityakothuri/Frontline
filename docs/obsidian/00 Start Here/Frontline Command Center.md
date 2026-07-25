---
tags: [command-center, start-here]
status: active
phase: "Data cycle FINAL (2026-07-24): hybrid relevance (veteran-first + labeled general), live rows across every category refreshed 2026-07-24, Census-geocoded pins, honest trust labels, scheduled refresh with a freshness gate (all 5 secrets set, dispatch run green, VA sandbox healthy). Latest: Food+Clothing merged into 'Essentials', HUD general capped like food, data-model docs de-staled. Remaining: merge this branch to main; Feed America pilot sign-off."
updated: 2026-07-24
---

# Frontline Command Center

> **Find your next step.**
> This is the single entry point for the Frontline project. Start here every session.

---

## Current Status

🟢 **Frontline feature-complete on live data + real AI (Phases 0–10).** A veteran opens the app,
picks **what they need help with**, and sees **nearby, veteran-first real resources** (list + map,
~130k+ rows ingested from official/nonprofit sources) with working Call/Directions, detail pages,
**real Claude** next-step plans, call scripts, and benefit summaries (served through the `ai` Edge
Function proxy), saved resources, an optional on-device profile — and a consistent **trust layer**:
source badges everywhere, stale/unverified warnings, the persistent "not the VA" disclaimer, and
crisis routing (988 press 1 / 911) on the Emergency path. Remaining is release engineering (EAS build
profiles, an Android Maps key, store assets). The dev framework (agents, hooks, rules, skills, MCP,
Obsidian, workflow) is **preserved**.

## Current Phase

**Feature-complete (Phases 0–10).** Done: [[Phase 0 Setup]] · [[Phase 1 App Shell]] ·
[[Phase 2 Resource Data Model and Service]] · [[Phase 3 Guided Need Flow]] ·
[[Phase 4 Resource List and Detail]] · [[Phase 5 Map and Discovery]] ·
[[Phase 6 AI Plans and Call Scripts]] · [[Phase 7 AI Summarization]] ·
[[Phase 8 Saved and Profile]] · [[Phase 9 Trust and Verification]] ·
**[[Phase 10 Backend and Data Ingestion]]** (live Supabase data + real AI proxy). Remaining: release
engineering (EAS, Android Maps key, store assets).

## Current Active Task

**🟢 Latest — Beautiful upgrade: per-category visual identity (2026-07-25), branch
`feature/beautiful-category-identity`.** Turned the under-used category colors into a real identity
system: a shared `categoryVisual` helper + `CategoryMedallion`, medallion-led resource cards with a
whisper category tint, a category-colored **detail hero** so each resource type opens distinctly, a
warm olive-washed **Home hero**, category-hued Discover chips, warmer empty states, an "intelligent"
AI block, and shadowed map pins. Category color is a semantic layer — **olive stays the one action
color**; no side-rails (design-rule ban); AA contrast held. Dependency-free (`surfaceTint` solid tints
instead of a native gradient module). `npm run verify` + `npm test` (35) green; validated on the iOS
sim (distinct healthcare/legal heroes, color-coded lists). See
[[2026-07-25 Beautiful upgrade — per-category identity + warm depth]].

**🟢 Final professionalism audit + consolidation to `main` (2026-07-25).** Three expert
sweeps (frontend/backend/ingestion) confirmed senior-level code; fixed what a judge docks points for.
**Merged all 3 outstanding branches into `main`** (union-resolved the doc conflicts). **Docs:** rewrote
the README to the real live-data + real-AI system, scrubbed stale/contradicting docs. **Tests:** added
a Vitest suite (35 unit tests) + wired CI (Node 22). **Security (deployed):** edge functions now
rate-limit on the trusted `x-forwarded-for` hop, cap caller payloads (→413), and set `Allow: POST`;
`SECURITY.md` documents the anon-key model + accepted risks. **Tooling:** package.json metadata,
`engines`, `.nvmrc`, `.editorconfig`, stricter ESLint. `npm run verify` + `npm test` green; edge
re-smoke-tested (200/405/413); app re-verified on the sim. See
[[2026-07-25 Final professionalism audit — consolidate, docs, tests, security]].

**🟢 Extreme final frontend audit (2026-07-24), branch `feature/frontend-audit-see-in-map`.**
Disciplined design system confirmed; this was targeted hardening + one feature. Shipped: (1) **"See in
map" on every opportunity** — a reusable `SeeInMapButton`, enabled when a resource has coordinates,
**struck-through "Not on map" + disabled** otherwise; context-aware (Results focuses the pin in-place,
detail/Discover/Saved open the Map tab via `?focus=`); `ResourceMap` animates to the pin after
`onMapReady`. (2) **No text overlap** — truncation/`flexShrink`/`flexWrap` across ResourceCard,
badges, contact rows, map legend/footer, profile. (3) **Unified tokens** — `shadows` (sm/md/lg),
`xxs` optical step, `displayLarge`, earth-tone `onboardingAccents`. `npm run verify` green; qa-tester
PASS; ui-reviewer Ship; **verified on an iOS sim** (cards, struck off-map state, map focus + preview).
Ready to PR (independent of the Essentials branch). See
[[2026-07-24 Frontend audit — See in map, overlap fixes, design tokens]].

**🟢 Repo-setup audit + inference verified live (2026-07-24), branch `chore/repo-setup-audit`.**
Audited the dev infrastructure (3 sweeps): CI runs typecheck+lint on PRs, the quality hook works,
`.gitignore` is clean, deps aligned. **Fixed:** restored the broken skill store (`.agents/` was
un-ignored + unpopulated → 16 dangling symlinks; agent-referenced `react-native-best-practices` +
`github-actions` now resolve; `.agents/` gitignored) and the stale `.env.example` offline-mode wording.
**Deferred (recs):** EAS config, Android Maps key, test framework, secret rotation, Node pinning.
**Small inference smoke test PASSED** — a Haiku `summary` call to the deployed `ai` function returned
HTTP 200 + a valid BenefitSummary (full client→function→Anthropic chain proven). Pending frontend work
committed + pushed (`feature/frontend-audit-see-in-map`); infra fixes on `chore/repo-setup-audit`. See
[[2026-07-24 Repo-setup audit + small inference smoke test]].

**🟢 Data cycle FINAL — shipped to `main` + app verified (2026-07-24).** All work merged
(PRs #9/#11/#12); `npm run verify` + CI green; live DB **134,336 rows**, 198 MB. Pillars:
**(1) veteran-centric** — hybrid rule (veteran rows fill the search cap first + win ties;
general rows badged "Open to everyone"; migrations `0013`/`0014`/`0016`); **(2) abundant** —
food **116,501** (8 veteran-dense states), education 12,849 (Census-geocoded pins), legal 856
(LSC), housing 1,554 (HUD 1,315 + SSVF 235), healthcare 1,816, benefits 448, jobs 306;
**(3) auto-updating** — cron workflow on `main` (jobs weekly / places monthly) + `freshnessGate.ts`
fails CI on stale sources + auto-opens an issue. **Ran the actual app** (onboarding → Discover →
results → detail): all screens render, badges/labels/geocoded distances correct, AI proxy healthy.
**Found + fixed a publish-blocker by running it** — the "all" browse 500'd (statement timeout) at
116k food rows; migration `0017` adds a bounding-box pre-filter + index (500 → 200 in 0.57 s).
Data integrity clean: 0 unpaired coords, 0 null-island pins, 0 orphans, 0 mislabeled trust.

**Automation PROVEN (2026-07-24 eve):** all 5 secrets set; **dispatched the `jobs` workflow — it
succeeded** (USAJOBS 306→345, purge + freshness gate green). Workflow VA base-URL bug fixed (PR #13,
was defaulting to sandbox). The cron is real and working.

**✅ VA-key blocker RESOLVED (2026-07-24 audit):** the current `VA_API_KEY` is a **sandbox** key and
works — sandbox returns **200** with the full national public facility set (health 1,399 / benefits
444 / vet_center 417, matching the live table); only `api.va.gov` (production) 401s, which is expected
for a sandbox key. VA facility data is public, so sandbox mirrors production — the workflow already
defaults the base URL to sandbox to match the key (`refresh-data.yml:52`). Confirmed live: **every
provider (incl. va-facilities) has `last_checked = 2026-07-24`**, all 5 secrets set, last dispatch run
green. Production data would need a separately-provisioned production key, not required for MVP. See
[[Decision Log]] "VA Facilities sandbox is the authoritative source".

**🟢 Latest — Data audit + Essentials merge + hardening (2026-07-24).** Audited every data source;
merged **Food + Clothing → "Essentials"** (need-level, no DB migration), capped general HUD housing to
nearest ~20 like food (`DENSE_GENERAL_CAPS = { food: 20, housing: 20 }`), and de-staled the
Resource Data Model doc + ingestion README. `npm run verify` green; qa-tester PASS; ui-reviewer Ship.
Branch `feature/essentials-merge-data-hardening` — ready to merge. See
[[2026-07-24 Data audit, Essentials merge, veteran-first hardening]].

**Publishability (release-manager audit):** engineering is strong (clean RLS, env hygiene, green
CI, honest data). Store-blockers are the usual pre-launch non-code work: no EAS project/`eas.json`,
no Android Google Maps API key (Android map blank in release), no privacy policy, placeholder
bundle id `com.frontline.app`, no crash reporting/error boundary. None are data-cycle issues.

**Next (user):** (a) merge `feature/phase-10-backend` → `main`, set secrets (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `VA_API_KEY`, `USAJOBS_API_KEY`, `USAJOBS_USER_AGENT`), run a manual
`workflow_dispatch` to verify; (b) re-run `--source va-facilities --national` with the VA key
(activates Vet Center cross-listing); (c) approve/decline Feed America CC BY-SA + national food
rollout after the TX spot-check. Then the data cycle is closed and focus moves elsewhere.

<details><summary>Prior — Phase 12 / WS-7 ingestion go-live (2026-07-20)</summary>

**🟢 Phase 12 / WS-7 — real data ingestion LIVE & app returns real results by ZIP (2026-07-20).**
Standalone `ingestion/` tooling (not app-bundle) pulls two official sources through the **unchanged
`ResourceService`**: **VA Facilities** (nationwide — `--national` sweeps all usable types) and
**USAJOBS** (federal jobs, location-scoped). Migration **0008** (`resource_sources` lineage +
`external_id`/`source_provider`/`ingested_at` + dedup index; advisors clean). `resources` now
**2,373**: 12 curated + **2,261 VA nationwide** (1,816 healthcare + 445 benefits) + **100 jobs near
Dallas** — all `official`/`verified`, idempotent re-runs. **Fixed the reported bug**: ZIP 75034 was
showing LA placeholders because the first VA load was LA-only; nationwide load means **any ZIP gets
real distance-ranked results** — **verified on the simulator** (75034 healthcare = Sam Johnson VA
Clinic 8.3 mi, Dallas/Denton/Garland, "Official source" badges). Keys (VA sandbox, USAJOBS,
service-role) in git-ignored `.env.seed`. `npm run verify` green. **WS-6 Google auth deliberately
skipped**. See [[2026-07-15 WS-7 VA Facilities Ingestion]].

**Bug fixed (2026-07-20):** Discover + Map were showing **nationwide** (incl. LA) results ignoring
the ZIP, because browse (`listResources`) had **no radius filter** — invisible at 12 seed rows,
broken at 2,373. Now radius-scoped to the profile ZIP (default 15 mi); verified on device (Map
centered on DFW, 0 LA rows near 75034). See [[2026-07-20 Browse tabs show nationwide results ignoring ZIP]].

**Card copy + polish (2026-07-20):** de-jargoned card descriptions (VA `describeVaFacility()` — no
more "CBOC"; Vet Centers read as counseling; jobs salary formatted + dupes collapsed) and **hid the
"Hours unknown" pill for jobs** (`ResourceCard`/`ResourceDetail`/`ResourcePreview`). The full
next-sources roadmap (HUD, HRSA, SAMHSA, College Scorecard, CareerOneStop, 211/findhelp — with how to
get each key) is **[[Resource Source Integration Plan]]**.

**AI speed + data audit (2026-07-21):** all AI tasks moved to **Haiku** for faster inference (env
secrets, `ai` redeployed; reversible — see [[Decision Log]]). Full data audit of all 2,362 rows:
**0 errors** (descriptions, names, coords, categories all clean; the 23 non-CONUS coords are
legitimate overseas/territory VA facilities). Sparse categories degrade gracefully (empty state +
official-sources fallback). Data is demo-ready; real coverage still needs the [[Resource Source Integration Plan]] sources.

**Next:** (a) **more sources for breadth** (Tier-1 free/official: **HUD** housing, **HRSA** health
centers, **SAMHSA** treatment, **College Scorecard** education, **VA Benefits/Forms**; then
directory-grade **211/findhelp** → `needs_review`) — this fills food/clothing/housing/legal/
transportation, the categories still empty; (b) **USAJOBS for more metros** + a **freshness/purge**
job for expired postings; (c) request VA **production** access (a demo, ~1–3 months) to lift the
sandbox limit before public launch; (d) pre-launch polish (WS-2/3/4/5). Owner hygiene: consider
rotating the `service_role` key post-demo (pasted in chat). Prior: **🟢 Phase 10 backend LIVE** —
migrations 0001–0006, `zip_centroids` (33,791), `ai`+`sync` ACTIVE, cost controls
([[2026-07-15 Backend Go-Live Cost Controls and Production Plan]]).

</details>

<details><summary>Prior — Phase 10 backend slice 2: saved/profile backup sync</summary>

([[2026-07-12 Phase 10 Supabase Backend and Claude Proxy]] → slice 2, branch
`feature/phase-10-backend`, uncommitted). Server-side backup of the on-device saved list + profile
so they survive a reinstall — **no login** (privacy by default). Identity is a random UUID in the
iOS keychain / Android keystore via **`expo-secure-store`** (survives app deletion on iOS →
reinstall-restore; **Android is backup-only** — wiped on uninstall, recovery code is a later slice).
The UUID is a bearer secret, so the `saved_backups`/`profile_backups` tables are **deny-all**,
reached only through a service-role **`sync` edge function** (anon-key gated, rate-limited,
`updated_at`-monotonic). New `src/services/sync/{deviceId,backupClient,backupSync}` + migration 0005;
`SavedContext`/`ProfileContext` restore-before-hydrate and mirror on change with their public APIs
**unchanged** — and **every sync call is a no-op offline**, so mock mode is byte-for-byte identical.
Merge: saved = union, profile = local-wins-else-restore; reset clears the backup. `npm run verify`
green; iOS bundle exports clean; qa-tester run. **⚠️ Needs a native rebuild** (secure-store plugin)
before the next dev build, and deploy adds `functions deploy sync`. See [[Decision Log]].

Prior: **🟡 Phase 10 backend slice 1: Supabase + Claude proxy**
([[2026-07-12 Phase 10 Supabase Backend and Claude Proxy]], branch
`feature/phase-10-backend`, uncommitted). Real resources (Supabase Postgres) and real Claude AI
(Supabase Edge Function proxy) implemented **behind the unchanged `ResourceService`/`AiService`
interfaces** — the swap the seams were built for. New `supabase/` scaffold (migrations mirroring the
`Resource` type + `zip_centroids` + one nullable-arg `search_resources` RPC + rate-limit table;
Deno `ai` edge function using `claude-opus-4-8` with structured outputs; 12 curated LA rows extracted
verbatim from the seed; `scripts/seed.ts`), and client `src/services/supabase/` + `SupabaseResourceService`
+ `ClaudeAiService`. **Env-gated factory switch**: no `.env` → full offline mock/templated mode
(verified on sim); config present → real backend. Failure honesty: resource failures → error/retry
UI (never silent mock data); AI failures → per-call templated fallback. `npm run verify` green; iOS
bundle exports clean; qa-tester **PASS** (its one deploy blocker — newer `sb_publishable_` keys
aren't JWTs — fixed in `client.ts` + the AI function now self-verifies the anon key; 3 hardenings
applied); slop-check pass. **⚠️ Deploy is a user step** — see the runbook in the build log (create
Supabase project + Anthropic key, `db push`, seed, deploy function, set secrets), then live E2E.

Prior: **✅ Backend-readiness audit + hardening**
([[2026-07-12 Backend Readiness Audit and Hardening]], branch
`feature/phase-9-trust-verification`, uncommitted): full audit ahead of Phase 10 — seams
verified airtight (one-line `resourceService`/`aiService` singleton swaps; zero UI imports of
seeds/mocks; AsyncStorage confined to the 3 storage modules; zero `fetch`/env usage;
`.mcp.json` ignored & never committed; iOS Hermes bundle exports clean). Five gaps found and
fixed: error+retry states on the detail route (`error` ≠ `notFound`), Saved resolve, and the
detail AI blocks (one retry card, engagement split so retries don't double-count); dead
`Resource.ai_summary` removed (type + 12 seeds); `SEED_CENTER` de-exported (map first-paint
now derives from the first pin). `npm run verify` green; bundle re-exported clean. ⚠️ Error
branches are unreachable with the never-throwing mock — exercise them when the first real
service lands. See [[Decision Log]].

Prior: **✅ Phase 9: Trust & Verification surfacing**
([[2026-07-11 Phase 9 Trust and Verification Surfacing]], branch
`feature/phase-9-trust-verification`, uncommitted): the audit showed Phases 4–8 had already
shipped most trust UI; Phase 9 filled the four real gaps. New **`NavigatorDisclaimer`** ("not
the VA or a government agency") on Results + detail (initially Home too — removed same day on
user feedback; two placements is the ceiling). Same-day trim: the AI blocks' footer not-advice
disclaimer was removed as redundant — the "AI-generated — verify with the source" tag is each
block's one label (service contract unchanged). New **`CrisisBanner`** on Emergency results — 911 **text-only** (mis-tap safety),
tappable **"Call 988, then press 1"** — hoisted above the results state machine so it survives
loading/error/empty/list, plus the map branch. Trust chrome converged: new shared **`SourceRow`**
badge (card + detail + map preview — the preview was the last badge-less surface; two inline
duplicates deleted), **`DangerCallBanner`** shell wrapped by both danger banners, and
**`trustWarning()`** amber guidance on detail (same predicate as `sourceStatus`, so badge and
warning can't disagree). New **`colors.dangerText`** AA token; `callPhone` now alerts instead of
failing silently with no dialer. `npm run verify` green; qa-tester **PASS** on
[[MVP Acceptance Criteria]] §F; all ui-reviewer P1/P2/P3s fixed in-task; `/slop-check` pass.
3 approved new files, 0 new deps, pure-JS. ⚠️ Needs an on-device pass (Emergency banner in all
branches, 988 button + no-dialer alert, disclaimer at large text, SourceRow wrap in the map
preview).

Prior: **✅ Profile view/edit split** ([[2026-07-11 Profile View Edit Split]]): the Profile tab is now
a **read-only at-a-glance screen** (shared `ScreenHeader` + avatar hero + one info card with ZIP /
radius / document names, Reset pinned at the bottom) with editing behind a **top-right pencil
button** — the old summary-over-always-editable-form stack is gone. `ScreenHeader` gained a trailing
**`action` slot** (reusable by other tabs). Edit mode: same form sections, Save with a failure
alert, X cancel with a dirty-check "Discard changes?" confirm. `qa-tester` passed; all `ui-reviewer`
P1/P2s fixed in-task (font-scaling overflow → view scrolls gracefully; header pattern converged;
docs shown by name). `npm run verify` green; pure-JS. ⚠️ Needs an on-device pass (toggle, discard
confirm, large-text scrolling).

Prior: **✅ Granola UI overhaul (olive accent, action row, call-script sheet, motion).** Full
app-wide polish pass ([[2026-07-10 Granola UI Overhaul Olive Accent Action Row Call Script Sheet]]):
accent moved lime → **true olive `#5F7326`** (paper-white on-accent text; a first gray-ish candidate
was replaced on user feedback) + a text-grade amber `warningText` fixing an AA failure on the trust
labels; the detail page's pinned Call/Directions footer became a compact **`ActionRow`** pill
cluster under the header (Call · Directions · Save · Share · Call script — Save moved out of the
route header); the call script now opens in a new generic **`BottomSheet`** (Modal+Animated, no new
deps) via `CallScriptSheet`; **`Skeleton`** loading states (AI blocks + Results); stack/tab
transitions (`ios_from_right`, fades); `Card` whisper shadow; springy `PrimaryButton`; onboarding
progress bar animates in both directions. 4 approved new files, 0 new deps. `npm run verify` green;
iOS Hermes bundle exports clean; `ui-reviewer`/`qa-tester` findings all fixed in-task.
⚠️ Needs an on-device pass: sheet on Android (back button), share sheet, pill wrap on small screens.

Prior: **✅ Official Online Sources widget.** Each category (Results) page now shows a supporting
**"Official online sources"** widget below the local cards (and in the empty state): 3–5 curated
trusted links per `NeedCategory` (VA.gov, federal, state/county directory pointers, verified
nonprofits), each with a **trust badge** and an external link. Curated static data
(`src/data/officialSources.ts`) + `OfficialSourcesWidget`; local finder stays primary; not a tab.
`npm run verify` green; pure-JS, app healthy. Build log: [[2026-07-09 Official Online Sources Widget]].
⚠️ Results widget needs an on-device tap-through to eyeball.

Prior: **✅ Gorgeous account-creation flow + concise Profile**
([[2026-07-09 Welcome Flow and Concise Profile]]) · `index.tsx` is now a **pure gate**;
the app opens straight into a cohesive pipeline: **Welcome hero** (brand mark + halo + staggered
entrance) → the 5 prompts (progress) → a **Create account** finale (success check + recap) → saves →
Home. New `OnboardingWelcome` + `OnboardingComplete`. The **Profile** was decluttered to compact
**pill** chips + tighter spacing (was tall rows). `npm run verify` green; pure-JS. A clean reinstall
opens straight to the welcome (hero confirmed rendering). Build log:
[[2026-07-09 Welcome Flow and Concise Profile]]. ⚠️ Full walk-through needs an on-device tap pass.

Prior: **✅ Setup + profile UI redesign** ([[2026-07-09 Setup and Profile UI Redesign]]) ·
**✅ Extended profile + multi-step setup** ([[2026-07-08 Extended Profile Multi-Step Setup]]) · Made the setup wizard + profile edit look premium (per the
`impeccable` product register): a new shared **`SelectableOption`** row + an `OptionGroup` **`variant`**
(pill/row), the wizard gained per-step **icon heroes**, a **progress bar**, **spring-in** step
transitions, big selectable rows + a **recap** done screen; the Profile tab gained an **avatar header**
+ grouped sections. Visuals only (no flow change). `npm run verify` green; pure-JS. Build log:
[[2026-07-09 Setup and Profile UI Redesign]]. ⚠️ Gated screens (wizard needs Reset; Profile needs a
tab tap) not screenshot-able here — needs an on-device look.

Prior: **✅ Extended profile + multi-step setup wizard**
([[2026-07-08 Extended Profile Multi-Step Setup]]) · Onboarding is now a real account-style
**wizard** (`app/onboarding.tsx` step machine: Name → ZIP → Role → Documents → Radius → Done; name +
ZIP required, rest optional/skippable). `VeteranProfile` gained `role?`/`documentsOnHand?`/
`preferredRadiusMiles?` (tolerant load; `saveDetails` merge). New shared `OptionGroup` + `TextField`;
the **Profile tab** is now one always-editable form; **radius personalizes search** (results + detail).
Disability rating omitted (too sensitive). `npm run verify` green; pure-JS, app healthy. Build log:
[[2026-07-08 Extended Profile Multi-Step Setup]]. ⚠️ Wizard/form need an on-device pass (Profile →
Reset to see the wizard).

Prior: **✅ Phase 8: Saved resources** ([[2026-07-08 Phase 8 Saved Resources]]) ·
**✅ Phase 6: deepened AI** ([[2026-07-08 Phase 6 Deepen AI Plans Call Scripts]]) · New on-device `saved` store
(`frontline.saved.v1`, ids-not-snapshots) mirroring profile/activity; a **bookmark** toggles save on
the resource card and the `/resource/[id]` route header; the **Saved tab** lists saved opportunities
(resolved live via `getById`, unsave removes with no flash). Resources-only for now; the extended
optional profile is a later slice. **Phase 7** (AI summarization) marked done — the summarizer was
delivered in Phases 4/6. `npm run verify` green; pure-JS (no rebuild), app healthy. Build log:
[[2026-07-08 Phase 8 Saved Resources]]. ⚠️ Save/unsave/persist flow + `ui-reviewer`/`qa-tester` need
an on-device pass.

Prior: **✅ Phase 6: deepened AI (plans + call scripts)**
([[2026-07-08 Phase 6 Deepen AI Plans Call Scripts]]) · Specific next-step
timing ("call before [closing] today" via a new `closingTimeToday` helper) + walk-in/online signals;
**name-personalized** standard call script (`firstName?` on `buildCallScript`); **copy-to-clipboard**
(`expo-clipboard`, native rebuild); and an **emergency fast-path** (contact-only urgent Call banner +
short default tone). Stays offline — real Claude is a future drop-in behind the same `AiService`.
`npm run verify` green; native build succeeded (`ExpoClipboard` linked), app healthy. Build log:
[[2026-07-08 Phase 6 Deepen AI Plans Call Scripts]]. ⚠️ Detail-page AI surfaces + `ui-reviewer`/
`qa-tester` need a human/on-device pass.

Prior: **✅ Polish: category color, tap motion, tighter detail page**
([[2026-07-08 Polish Color Motion Detail Structure]]) · Added a **category-color**
layer (icon chips + map pins; distinct from the semantic colors) + `withAlpha` tint helper; **tap
motion** via RN `Animated` — a `PressableScale` for cards + a spring-in for the map preview (no new
dep); and **restructured the detail page** (top-down order, rating in the header, dropped redundant
sections, **call script behind a "Get a call script" button** that auto-generates on reveal).
`npm run verify` green; app reloaded healthy (5-tab bar renders). Build log:
[[2026-07-08 Polish Color Motion Detail Structure]].

Prior: **✅ Dedicated Map tab + spacing pass** ([[Decision Log]]) · The map is now a **bottom-nav tab**
(`app/(tabs)/map.tsx`, all opportunities as pins — reuses `ResourceMap`), so it's one tap from
anywhere instead of four; tabs are **Home · Discover · Map · Saved · Profile**. Also a
`ui-reviewer`-checked spacing pass across Home/Discover/Map (uniform `xl` gutter, `lg` top inset,
shell row groups with its list). `npm run verify` green; pure-JS (no rebuild). See
[[Decision Log]] · build log [[2026-07-08 Home Redesign Discover Tab Fullscreen Map]].

Prior: **✅ Map location** — GPS + ZIP-fallback recenter + "you are here" (expo-location, native
rebuild; LA data stays anchored) ([[2026-07-08 Map Location GPS ZIP Recenter]]) ·
**✅ Home/Discover redesign + fullscreen map + activity feed**
([[2026-07-08 Home Redesign Discover Tab Fullscreen Map]]) · Three architect-reviewed
pieces: (1) the Results **map is fullscreen** with a floating toggle; (2) a new **Discover** tab
(Home · Discover · Saved · Profile) — shell row over all opportunities via a new
`listResources(category?)` browse seam, "Other" → full category list; (3) a **personalized Home**
(greeting + stable-per-day random message + a "How was X?" 👍/👎 review card, or Explore-help CTA →
Discover), backed by a new **on-device activity store** (`frontline.activity.v1`) that records
engagement on the detail page. The 👍/👎 and a **deterministic simulated** community rating are shown
as separate facts, always labeled "simulated (demo)". `npm run verify` passes; the app bundles and
the new Home renders on the sim. Build log: [[2026-07-08 Home Redesign Discover Tab Fullscreen Map]].
⚠️ **Interactive tap-through (Discover/map/vote) + `ui-reviewer`/`qa-tester` still pending** (sim tap
couldn't be automated here).

Prior: **✅ Phase 5 map + discovery** ([[2026-07-08 Phase 5 Map and Discovery]]) ·
**✅ Phase 4 resource detail page** ([[2026-07-08 Phase 4 Resource Detail Page]]) ·
**✅ Granola light "paper" re-skin** ([[2026-07-07 Granola Reskin Light Paper Theme]];
⚠️ splash/app-icon artwork still dark-era) ·
**✅ Stage 4 / Onboarding / Phase 3 / Phase 2 / Reframe.** See [[Decision Log]].

</details>

## Next Recommended Task

**The accumulated on-device QA pass** — it now covers Phase 9 too: pick **Emergency** in Discover →
the crisis banner shows above the list, the map view, the empty state, *and* the error state; tap
**"Call 988, then press 1"** (on a device without a dialer the fallback alert shows the number);
confirm 911 is plain text. Check the **navigator disclaimer** sits at the bottom of Results and
resource detail (not Home — removed on feedback) and stays quiet at large accessibility text sizes; check the **trust badge** in the
map pin preview wraps rather than overflows; open a stale resource (transportation) and an
unverified one (community support) to see the amber warning sentence. Plus the still-pending items:
Profile view ⇄ edit toggle + discard confirm, ActionRow/Share/call-script sheet, Results list⇄map
ease, onboarding progress bar both directions. Then: **splash/app-icon artwork** (still
pre-palette), or [[Phase 10 Backend and Data Ingestion]] planning (post-MVP, needs approval).

---

## Product Source of Truth

- [[Product Overview]] — what Frontline is and why it matters
- [[MVP Definition|MVP Scope]] — exactly what's in and out of the MVP
- [[Feature Priority Order]] — the priority list
- [[Product Principles]] — the rules behind every decision
- [[User Personas]] — who Frontline is for
- [[User Stories]] — who does what and why
- [[Trust Safety and Privacy]] — verification, disclaimers, and data minimization
- [[MVP Acceptance Criteria]] — the testable definition of a done MVP
- [[Non-MVP Ideas]] — parked ideas, explicitly not now

## Roadmap

- [[Phase 0 Setup]] · [[Phase 1 App Shell]] · [[Phase 2 Resource Data Model and Service]]
- [[Phase 3 Guided Need Flow]] · [[Phase 4 Resource List and Detail]] · [[Phase 5 Map and Discovery]]
- [[Phase 6 AI Plans and Call Scripts]] · [[Phase 7 AI Summarization]] · [[Phase 8 Saved and Profile]]
- [[Phase 9 Trust and Verification]] · [[Phase 10 Backend and Data Ingestion]]

## Technical Source of Truth

- [[Technical Architecture]] · [[AI Feature Design]] · [[Resource Data Model]]
- [[Folder Structure]] · [[Environment Variables]]
- [[Quality Gates]] · [[Production Workflow]] · [[Git Workflow]] · [[Release Workflow]]
- [[Testing Strategy]] · [[File Creation Policy]] · [[Anti-AI-Slop Code Rules]] · [[Claude Development Rules]]

## Design Source of Truth

- [[UI Design System]] · [[Screens List]] · [[App Flow|Core User Flows]]
- [[Map and Search Design]] · [[UX Principles]] · [[Anti-AI-Slop Design Rules]]

## Claude Workflow

- Prompts: [[Claude Session Prompt]] · [[Start Task Prompt]] · [[Finish Task Prompt]] · [[Feature Build Prompt]] · [[Code Review Prompt]]
- Skills: `/start-task` · `/finish-task` · `/log-session` · `/slop-check`
- Subagents: `product-manager` · `react-native-architect` · `ui-reviewer` · `qa-tester` · `release-manager`

## GitHub Workflow

Guides in `docs/github/`:
[GitHub Setup](../../github/GitHub%20Setup.md) ·
[Branching Strategy](../../github/Branching%20Strategy.md) ·
[Pull Request Checklist](../../github/Pull%20Request%20Checklist.md) ·
[Release Process](../../github/Release%20Process.md).

- **One task per branch** — never do feature work on `main`.
- **Before** meaningful code changes: create/confirm a task branch.
- **After** meaningful code changes: run quality checks + update the Obsidian logs before a
  PR/commit. PRs use the [PR template](../../../.github/pull_request_template.md).
- Claude never commits, pushes, force-pushes, or creates the remote without explicit approval.

## Logs

- Build logs → `06 Build Logs/` (see [[Build Log Template]])
- Decisions → [[Decision Log]]
- Bugs → `07 Bugs/` (see [[Bug Report Template]])
- Feature specs → `12 Feature Specs/` (see [[Feature Spec Template]])
- Claude reviews → `11 Claude Reviews/` (see [[Claude Review Template]])

## App Walkthrough

- **[[app_walkthrough]]** — the living, guided explanation of how the codebase actually
  works. It **must** be updated after every moderate or meaningful feature/code change.

---

## Rules That Must Not Be Broken

1. **One task at a time.** No "build everything" sprints. Scope, implement, review, log.
2. **No app source files without approval.** State path + purpose + contents first, then wait.
   See [[File Creation Policy]].
3. **AI is embedded in workflows, never a chatbot**, and is **never** presented as legal, medical,
   financial, or government-certified advice. See [[AI Feature Design]].
4. **Trust & privacy first.** Every resource shows its source + last-checked; collect the minimum,
   never SSN/VA-login/bank/diagnosis. See [[Trust Safety and Privacy]].
5. **Update logs after meaningful changes.** Build log + [[app_walkthrough]] at minimum;
   [[Decision Log]] and bugs when relevant. See [[Production Workflow]].
6. **No AI slop.** Intentional, typed, readable code and designed (not templated) UI. See
   [[Anti-AI-Slop Code Rules]] and [[Anti-AI-Slop Design Rules]].
7. **Simulation is labeled honestly.** `mock` / `demo` / `simulated` in code and docs.
8. **Work on a task branch.** Never commit feature work to `main`; never force-push or create the
   remote without approval. See [Branching Strategy](../../github/Branching%20Strategy.md).
