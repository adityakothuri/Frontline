---
tags: [decisions, source-of-truth]
status: active
updated: 2026-07-24
---

# Decision Log

Running log of notable product, design, and technical decisions (lightweight ADRs). Add a new entry
(newest at top) whenever a meaningful choice is made. Each entry: context → decision → consequences.

> Reset on 2026-07-07 when the project was reframed to Frontline. Earlier-era
> decisions were intentionally not carried over; they applied to a product that no longer exists.

## Entry template

```md
### YYYY-MM-DD — <decision title>
- **Status:** accepted | superseded by [[…]] | revisited
- **Context:** what forced a choice
- **Decision:** what we chose
- **Alternatives:** what we didn't choose, briefly
- **Consequences:** what this implies going forward
```

---

### 2026-07-26 — Bundle identifier is `com.kothuri.frontline`, not `com.frontline.app`
- **Status:** accepted
- **Context:** The first real EAS build failed at credential setup: Apple rejected the App ID with
  *"`com.frontline.app` is not available"*. Bundle identifiers are unique across **all of Apple**, not
  just within a team — `com.frontline.app` was already registered to someone else. Nothing in the repo
  could have detected this; it is only knowable by asking Apple, which first happens at build time.
- **Decision:** Change `ios.bundleIdentifier` **and** `android.package` to `com.kothuri.frontline` —
  a personal reverse-DNS namespace matching the enrolled team, "Ananth Kothuri (Individual)"
  (MT5QJPXQS7). Both platforms kept in sync even though 1.0 ships iOS-only.
- **Alternatives:** `com.ananthkothuri.frontline` (exactly matches the team name, but longer);
  `io.github.adikothuri.frontline` (guaranteed unique, but an open-source convention that reads oddly
  for a consumer App Store app). A domain-backed id was not an option — we don't own `frontline.app`.
- **Consequences:** **Permanent once published** — it cannot be changed after the first submission.
  Leaves `com.kothuri.<name>` free for future apps. Historical build logs still say `com.frontline.app`
  and were deliberately left alone as dated records; forward-looking docs were updated. Anyone with a
  stale local `ios/` directory must re-run `npx expo prebuild --clean` before building locally — EAS
  builds are unaffected because `/ios` is gitignored and the cloud prebuild is always clean.

---

### 2026-07-25 — Per-category visual identity as a semantic layer (not actions); dep-free tints
- **Status:** accepted
- **Context:** The app looked clean but flat — every category has a color, used only on tiny glyphs.
  Goal: make different opportunity types "look different" while staying calm/premium.
- **Decision:** Introduce a **category visual identity** (medallion + a soft `surfaceTint` card/hero
  wash) driven by a shared `categoryVisual` helper + `CategoryMedallion`. Category color is a
  **semantic identity** layer (like green=verified); **olive stays the single action color**. Per the
  design-rule ban, **no colored side-rails** — identity is medallions + tints. The detail page is the
  one "committed" category surface (a colored hero zone). Contrast kept AA (tints ≤ ~14%; text on ink).
- **Alternatives:** colored left-rail on cards (rejected — banned cliché + AA risk); category color on
  buttons (rejected — breaks the one-accent rule); a bolder multi-color leap (rejected — betrays the
  calm/trust identity).
- **Consequences:** Lists read as color-coded sets; each detail page has a distinct premium identity;
  the action language stays a single olive. New categories inherit the system for free.

### 2026-07-25 — Drop expo-linear-gradient; use dependency-free solid tints
- **Status:** accepted
- **Context:** The "richer & warmer" plan reached for gradient washes, but `expo-linear-gradient` is a
  **native** module — the running dev client predated it, so it rendered as an "Unimplemented
  component" (needs a full native dev-client rebuild).
- **Decision:** Achieve the warm, per-category look with **`surfaceTint`** (a solid alpha-composite of
  the hue over the paper surface) instead of gradients. Uninstalled `expo-linear-gradient`.
- **Consequences:** No native rebuild needed; keeps the minimal-deps discipline; the look is ~95% of a
  gradient's at zero dependency cost. A gradient vocabulary can return later if a native rebuild happens.

### 2026-07-25 — Final professionalism audit: consolidate to main, tests, security hardening
- **Status:** accepted
- **Context:** Submitting to a professionalism competition. Three expert sweeps found the code
  senior-level but the *repo* let it down: stale docs, no tests, edge-function security gaps, thin
  metadata. The app also lived across `main` + 3 unmerged branches.
- **Decision:** Merged all branches into `main` (union-resolved the append-only Obsidian docs); added
  a Vitest unit suite (35 tests); rewrote the README + fixed every stale/contradicting doc; hardened
  the edge functions (trusted-hop IP, payload caps, `Allow` header) and deployed them; added repo
  metadata/tooling. Documented the anon-key auth model + vote-integrity limit as **accepted risks**
  in `SECURITY.md` rather than shipping security theater; kept `verify` as typecheck+lint (not a
  93-file Prettier reformat) with `format:check` available.
- **Consequences:** `main` is the complete, polished submission; CI runs tests on Node 22. Deferred:
  EAS/Android-Maps release setup, and a stronger AI auth gate (needs a product decision).

### 2026-07-24 — Merge Food + Clothing into one "Essentials" need category
- **Status:** accepted
- **Context:** Clothing had almost no local dataset (1 national referral) while Food is dense; two
  near-empty-vs-dense sibling tiles read as uneven. Wanted one coherent "material basics" entry.
- **Decision:** Merge at the **need level only** — `NeedCategory` goes 12→11, `essentials` replaces
  `food`+`clothing`, and `needMapping.ts` fans `essentials → ['food','clothing']`. The underlying
  `ResourceCategory` values `food`/`clothing` stay separate in the DB (no migration, cards keep their
  distinct Food/Clothing chips for scan granularity). Label "Essentials", `basket-outline`, ochre
  `#A56E24`.
- **Alternatives:** a full resource-category merge (destructive DB migration, loses granularity for
  1 clothing row — rejected); keep them separate (rejected — uneven tiles).
- **Consequences:** One home tile spanning food + clothing; adding a real clothing dataset later needs
  no code change (it already maps in). Reuses the existing one-need→many-resource bridge pattern.

### 2026-07-24 — Cap general HUD housing in-app, like food (keep hybrid, don't purge)
- **Status:** accepted (extends [[2026-07-24 Data cycle final audit and hybrid rebuild]])
- **Context:** User asked to keep the app veteran-niche without losing volume. Audit showed ~89.5% of
  rows are `general`, almost all Feeding America food (capped ~20) + HUD housing (1.3k, **uncapped**).
  Purging general data would collapse Food to ~1 and Housing to ~240.
- **Decision:** Keep the hybrid model; tighten it. `DENSE_GENERAL_CAPS = { food: 20, housing: 20 }` so
  general HUD rows are capped to the nearest ~20 like food. `capDenseGeneral` only drops `general`
  rows, so veteran SSVF/curated housing is never dropped and still ranks first.
- **Alternatives:** strict veteran-only purge (rejected — guts Food/Housing volume, conflicts with
  "maintain lots of data"); leave HUD uncapped (rejected — inconsistent with food, general rows could
  crowd a metro feed).
- **Consequences:** Housing feed stays veteran-first with a bounded general backfill. No off-niche
  data exists beyond these two deliberately-kept, capped, labeled datasets.

### 2026-07-24 — VA Facilities sandbox is the authoritative source (don't "upgrade" to production)
- **Status:** accepted
- **Context:** An audit note assumed "sandbox = limited data" and proposed switching VA to production.
  Verified live: the free `VA_API_KEY` is **sandbox-scoped** (`api.va.gov` returns 401), and the
  sandbox returns the **full national public facility set** (health 1,399 / benefits 444 /
  vet_center 417 — matches the live table; all VA rows refreshed 2026-07-24).
- **Decision:** Keep the sandbox host as the default (the workflow already defaults there to match the
  key, `refresh-data.yml:52`). Document that VA facility data is public so sandbox mirrors production —
  switching to `api.va.gov` requires a separately-provisioned production key or ingestion breaks. This
  also resolves the stale "VA key rejected (401)" blocker in the Command Center.
- **Alternatives:** flip the default to production (rejected — 401s with the current key, breaks the
  cron).
- **Consequences:** VA ingestion is healthy and complete on sandbox; no production key needed for MVP.

### 2026-07-24 — "See in map" on every opportunity, context-aware, with a struck off-map state
- **Status:** accepted
- **Context:** Resources could only be reached via external "Directions"; there was no way to see a
  specific opportunity on the in-app map, and no signal for resources that have no map location.
- **Decision:** Add a reusable `SeeInMapButton` to every card + the detail page. Enabled when
  `latitude && longitude`; otherwise **disabled with a struck-through map icon + "Not on map"**
  (never hidden — the veteran learns *why* it isn't pinnable). Destination is **context-aware**:
  Results flips to its own map view and zooms the pin in-place; detail/Discover/Saved open the Map
  tab via `?focus=<id>`. The map animates to the pin once `onMapReady` fires (gated so the camera
  move isn't dropped).
- **Alternatives:** always open the global Map tab (simpler, but loses in-place focus on the Results
  map); hide the button when off-map (rejected — the user explicitly wanted it on every opportunity).
- **Consequences:** One consistent affordance ties lists to the map. The Map tab's browse dataset can
  differ from a resource's origin, so a rare out-of-set focus won't zoom (still fits all pins).

### 2026-07-24 — Design tokens: shadows, an `xxs` optical step, `displayLarge`, onboarding accents
- **Status:** accepted (adds tokens per [[UI Design System]])
- **Context:** A frontend audit found three hand-rolled shadow recipes, four off-scale font sizes,
  scattered sub-`xs` magic numbers (`gap:2`, `padding:3`, `+2` arithmetic), and off-palette blue/teal
  onboarding icon colors.
- **Decision:** Add a `shadows` (sm/md/lg) token set, a single `xxs: 2` optical spacing step, a
  `displayLarge` type variant for onboarding hero titles, and an `onboardingAccents` earth-tone
  quartet (sage/taupe/ochre/clay) — deliberately avoiding the olive brand `accent` so a step icon
  never looks like a primary action. Replace the hand-rolled recipes/magic numbers/hexes with these.
- **Alternatives:** leave elevation/colors inline (rejected — reads as many systems, not one).
- **Consequences:** Elevation and optical spacing are now consistent and named; onboarding stays
  on-palette. `xxs` is documented as optical-only — layout rhythm stays on the 4/8 scale.

### 2026-07-24 — Skill store is installer-populated (gitignore `.agents/`); defer release items
- **Status:** accepted
- **Context:** A repo-setup audit found 16 committed `.claude/skills/` symlinks dangling into a missing
  `.agents/skills/` store, which was **not** git-ignored (git would try to track the whole vendored
  store). Three subagents referenced skills that wouldn't load.
- **Decision:** Treat `.agents/` as an **installer-populated store** (like `node_modules`) — add it to
  `.gitignore`, restore locally with `npx skills add …` (documented in `SKILLS.md`), and keep the
  committed `.claude/skills/` symlinks as the curated set. Removed installer-added symlinks for skills
  `SKILLS.md` had pruned for React Native. Deferred (with recommendations) the non-blocking items: EAS
  config, Android Maps key, a test framework, secret rotation, Node pinning.
- **Alternatives:** vendor `.agents/skills/` into the repo (rejected — large external store, some via
  SSH); remove the dangling symlinks + agent skill refs (rejected — the skills are wanted and restore
  cleanly).
- **Consequences:** Fresh clones must run the `npx skills add` restore (documented) before the extra
  skills resolve — the agent-referenced ones work once restored. Repo stays free of vendored skills.

### 2026-07-24 — AI inference verified live end-to-end (small smoke test)
- **Status:** accepted
- **Context:** Before scaling AI usage, confirm the deployed proxy actually serves inference.
- **Decision:** Ran a single Haiku `summary` call to the deployed `ai` edge function with a real
  resource row (`POST /functions/v1/ai`, anon key on `apikey`). Got **HTTP 200** + a valid, well-hedged
  `BenefitSummary`. The client→function→Anthropic→structured-JSON chain is proven.
- **Consequences:** Safe to build on the AI path (plan/script on Opus next). Model IDs
  (`claude-opus-4-8`, `claude-haiku-4-5`) confirmed valid and serving.

### 2026-07-21 — All AI tasks on Haiku (speed over the Opus cost-split)
- **Status:** accepted (secrets set + `ai` redeployed; env-reversible)
- **Context:** Opening a resource auto-loads an AI summary **and** plan; the plan ran on Opus with
  adaptive thinking, which felt too slow.
- **Decision:** Route **all** AI tasks (summary/plan/script) to **`claude-haiku-4-5`** via the
  function's env knobs — `ANTHROPIC_MODEL`, `ANTHROPIC_MODEL_PLAN`, `ANTHROPIC_MODEL_SCRIPT` — no code
  change. The function already gates off Haiku-incompatible fields (`thinking`/`effort`) by model.
  Verified: a `plan` call returns ~10s (cold) with good content; summaries were already Haiku.
- **Alternatives:** keep the WS-1 Haiku-summary/Opus-plan split (better plan quality, slower);
  Sonnet middle ground (untried). Rejected for now — latency was the complaint.
- **Consequences:** Faster detail-page AI and lower cost; slightly less depth on plans/scripts. Fully
  reversible: `supabase secrets set ANTHROPIC_MODEL=claude-opus-4-8 …`. Supersedes the model half of
  the [[2026-07-15 Backend Go-Live Cost Controls and Production Plan]] WS-1 split.

### 2026-07-15 — WS-7 ingestion: pipeline architecture + official-source freshness; skip WS-6 auth
- **Status:** accepted (slice 1 **live** 2026-07-17 — 41 real VA facilities loaded near LA via a VA sandbox key)
- **Context:** The 12 curated LA rows are a demo, not coverage — the #1 "ship it" gap. Starting real
  data ingestion (Master Plan §WS-7), and the owner directed **skipping Google auth** in favor of the
  existing local-device identity.
- **Decision:** (1) Ingestion is **standalone backend tooling** (`ingestion/`, run like
  `scripts/seed.ts`), **not** app-bundle code; one adapter per source behind a `SourceFactory`
  contract, writing through the service-role key. The app's `ResourceService` is unchanged. (2) First
  source is the **VA Facilities API** (official). (3) **Official-source rows get `last_checked` = the
  fetch date** — for an official API the fetch *is* the confirmation (non-official sources will
  default to `needs_review`). (4) Provenance lives in a new `resource_sources` lineage table +
  `external_id`/`source_provider`/`ingested_at` columns; dedup on a deterministic id `va:<id>`. (5)
  **WS-6 Google auth is skipped** — anonymous device-UUID sync stays the identity model.
- **Alternatives:** ingest inside the app / an edge function (rejected — keys + volume belong
  server-side); a shared `normalize.ts` now (rejected — premature for one source, folded into the
  adapter per anti-slop); stamping only `ingested_at` and leaving `last_checked` conservative
  (rejected — dishonestly hides that an official source just confirmed the row).
- **Consequences:** New sources = one module + a registry line; trust fields stay honest;
  `resources_needing_review` remains the curator queue for non-official data. Live load blocked on a
  real `VA_API_KEY` + the real `service_role` key in `.env.seed`. Apple "Sign in with Apple" concern
  is moot while no third-party sign-in ships.

### 2026-07-15 — AI cost controls: per-task models + hourly spend budget; publishable key
- **Status:** accepted (implemented + verified live)
- **Context:** Real Claude went live. Need to keep the app good while bounding cost, and the app's
  AI/sync were silently failing.
- **Decision:** (1) **Per-task model split** — Haiku for summaries (auto-load, cheap), Opus for
  plans/scripts (user-triggered, quality). (2) **Global hourly spend budget** in the `ai` function
  (`AI_HOURLY_BUDGET_USD`, default $5): pre-call gate → 429 → templated fallback; post-call records
  actual `usage`×price; **fail-open** with the **Anthropic console cap as the hard backstop**.
  (3) The app must use the **publishable key** (`sb_publishable_…`), not the legacy anon JWT — the
  functions gate on it (the JWT was 401'd, silently disabling AI/sync).
- **Alternatives:** single model for all tasks (simpler, ~8× summary cost); token-exact metering
  (more complex, marginal gain); fail-closed budget (safer cost, worse availability — rejected since
  the console cap already guarantees the ceiling).
- **Consequences:** AI costs are bounded and observable (`ai_spend`); models tunable via env with no
  redeploy; `[[Backend to Production Master Plan]]` WS-1 is the reference. Haiku can't take
  `thinking:adaptive`/`effort` — request shape is gated on the model.

### 2026-07-13 — Backup sync: device UUID over anonymous auth; iOS-only reinstall-restore
- **Status:** accepted (user-approved; slice 2 of Phase 10)
- **Context:** Saved/profile are on-device only — lost on reinstall. Wanted a backup that survives
  reinstall **without a login** (privacy by default). Two identity options: (a) Supabase anonymous
  auth (GoTrue) → real `auth.uid()` RLS; (b) a client-generated device UUID in secure storage.
- **Decision:** **(b).** The deciding fact: reinstall survival of a device-local secret is
  **iOS-keychain-only for both options** (`expo-secure-store` survives app deletion on iOS but is
  wiped on Android uninstall — Expo's own docs). So (a)'s only real benefit — true per-user
  isolation — buys nothing extra, while adding token-expiry/refresh-rotation to hand-roll over
  plain fetch for non-sensitive data, and reopening the no-supabase-js decision. Store a random
  UUID in `expo-secure-store` (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, off iCloud so it stays
  single-device). It's a bearer capability secret → the `saved_backups`/`profile_backups` tables
  are **deny-all**, reached only through a service-role `sync` edge function (anon-key gated,
  rate-limited, `updated_at`-monotonic). Local stays source of truth; restore-before-hydrate;
  saved = union merge, profile = local-wins-else-restore; reset clears the backup. **Scope: iOS
  reinstall-restore + universal server backup only** — Android reinstall-restore and cross-device
  both need an explicit recovery code (a later slice).
- **Alternatives:** GoTrue anonymous auth (token lifecycle for no gain); supabase-js (dead-weight);
  UUID in AsyncStorage (wiped on reinstall — loses the whole point); a login/account now
  (contradicts privacy-by-default); PostGREST header-GUC RLS keyed to the UUID (fragile, and the
  UUID would be guessable without the deny-all + service-role boundary).
- **Consequences:** one new native dep (`expo-secure-store`) → a dev rebuild is required before the
  next build; `useSaved`/`useProfile` and all screens unchanged; offline mode byte-for-byte
  identical; deploy runbook gains `functions deploy sync`. Android users get backup but must not be
  told their data survives a reinstall — documented explicitly.

### 2026-07-12 — Phase 10 backend architecture: Supabase, plain fetch, honest fallbacks
- **Status:** accepted (plan approved by user; slice 1 = read-only resources + AI proxy)
- **Context:** Phase 10 needed a platform, a client integration style, and failure semantics.
  User chose Supabase, resources+AI-only scope, real Claude now, curated data first.
- **Decision:** **Supabase** (Postgres + PostgREST + Edge Functions, one vendor). Client talks
  **plain `fetch`** — no supabase-js (we need none of auth/realtime/storage; zero new client deps).
  **No PostGIS** — plain haversine SQL at <10k rows. **One nullable-arg RPC** serves both search
  and browse; ZIP→origin via a Census ZCTA centroid table (no geocoding API). Unknown origin →
  **null distances, never a fake center** (the mock's SEED_CENTER fallback stays demo-only).
  Sorting stays client-side; comparators extracted to `sortResults.ts` so mock = executable spec.
  **Failure semantics are asymmetric by design:** missing env → wholesale mock/templated (offline
  demo mode); runtime resource failure → error/retry UI, **never silent mock resources** (showing
  simulated orgs as real places would betray veteran trust); runtime AI failure → per-call fallback
  to the templated service (safe, was the shipped product). The Claude key lives only in the edge
  function (`claude-opus-4-8`, structured outputs guaranteeing the exact AiService shapes; the
  client re-stamps `AI_NOT_ADVICE_DISCLAIMER`). Coarse per-IP-hash hourly rate limit, fail-open.
  Curation honesty: seed uploads `last_checked`/`verification_status` verbatim; no server-side
  staleness flips (client's 90-day `isStale` stays the single derivation; curator gets a view).
- **Alternatives:** Firebase (weak geo, NoSQL mismatch); custom Node+Postgres (most work);
  supabase-js (dead-weight deps); PostGIS (indexing we don't need); silent mock fallback (trust
  violation); server-side `needs_review` flips (conflates elapsed time with human judgment).
- **Consequences:** swapping to any future backend remains a two-factory change; the RPC argument
  names are a public API contract; `supabase/functions/**` is Deno-land (excluded from app
  tooling); deploy requires the user's Supabase project + Anthropic key (runbook in the build log).

### 2026-07-12 — Backend-readiness contract cleanups (pre-Phase 10)
- **Status:** accepted
- **Context:** A full backend-readiness audit confirmed the service seams are clean (one-line
  singleton swaps, no UI bypasses, storage contained), but found two contract warts and three
  consumers that would hang forever on a real network failure (the mock never rejects).
- **Decision:** (1) `Resource.ai_summary` **removed** — it was dead (summaries come from
  `AiService`); a backend schema should not inherit a phantom field. (2) `SEED_CENTER` is **no
  longer exported** from the resource service's public API — the map's first-paint region now
  derives from the first pinned result, so no mock concept leaks into the service contract.
  (3) Every service consumer now has an error + retry path: detail route (`error` distinct from
  `notFound`), Saved resolve, and the detail page's AI blocks (one retry card for both, styled
  after `CallScriptCard`'s failed state); engagement recording was split from the AI effect so
  retries never double-count views.
- **Alternatives:** keep `ai_summary` as a server-cached summary slot (rejected — speculative;
  add it back when a backend actually caches summaries); a global error boundary instead of
  per-surface retries (rejected — worse UX, hides which call failed).
- **Consequences:** Phase 10 is now genuinely "swap two singletons + geocode + AI proxy"; the
  failure UX already exists and mock→real cannot regress the happy path. Error branches remain
  demo-unreachable until a service can actually fail — test them when it can.

### 2026-07-11 — Phase 9 trust surfacing: 911 is never tappable; one badge, one banner shell
- **Status:** accepted
- **Context:** Phase 9 required a persistent navigator disclaimer, crisis routing on the
  Emergency path, and trust badges on every surface. Two safety/consistency choices came up:
  how to present 911, and how to stop the trust/danger UI from duplicating (the card and the
  detail page already carried byte-identical inline trust rows; a second danger banner would
  have cloned `EmergencyCallBanner`'s styles).
- **Decision:** In `CrisisBanner`, **911 is plain text, never a button** — a mis-tap must not
  place an emergency call; the tappable action is **"Call 988, then press 1"**, dialing plain
  `tel:988` with "press 1" in the copy (post-dial pause syntax is unreliable across dialers).
  The banner is hoisted **above the results state machine** so it survives loading/error/empty,
  not just success. Trust chrome converged into single owners: `SourceRow` (badge, used by
  card + detail + map preview), `DangerCallBanner` (danger shell wrapped by both banners),
  `trustWarning()` (derived from the same predicate as `sourceStatus()` so badge tone and
  warning text can never disagree). New `colors.dangerText` (#A93226) mirrors the
  `warning`/`warningText` split for AA contrast on tinted banners. `callPhone` now alerts with
  the number when no dialer exists instead of failing silently. The disclaimer appears on
  Results + detail — **two placements is the ceiling** (disclaimer fatigue). *Same-day
  user-feedback trim:* the Home placement was removed (disclaimer lives where resources are
  shown, not the greeting screen), and the AI blocks' footer not-advice disclaimer was dropped
  as redundant — the "AI-generated — verify with the source" tag is each block's single label;
  the `AiService` contract still returns `disclaimer` for a future surface that wants it.
- **Alternatives:** tappable 911 (mis-tap liability); `tel:988,1` post-dial pause
  (inconsistent); crisis banner as FlatList header (scrolls away) or only on the success
  branch (vanishes exactly when the search fails); a third inline copy of the trust row
  (anti-slop violation).
- **Consequences:** any new resource surface gets trust via `SourceRow`, any new danger banner
  wraps `DangerCallBanner`; trust copy/treatment changes are single-file edits. A real
  verification pipeline (Phase 10) only needs to feed the existing `Resource` trust fields.

### 2026-07-10 — Category colors move into the olive/earth family; call script is one script
- **Status:** accepted (narrows the rainbow palette of [[Decision Log#2026-07-08 — Polish: category-color layer, tap motion, detail restructure|2026-07-08 category-color layer]])
- **Context:** On device, the 12-hue category palette (blues, purples, pinks) clashed with the olive
  app — Discover's "Other" grid looked like a different product. Separately, the standard ⇄ "keep it
  simple" call-script toggle added a choice most veterans don't need at a stressful moment.
- **Decision:** Category colors are now **variants within the olive/earth family** (olives, sages,
  ochres, warm browns — still one distinct color per category; emergency alone leans rust-red).
  `NEED_CATEGORY_META` and `RESOURCE_CATEGORY_META` must stay in sync per category. The call script
  UI offers **one script** — the tone is picked by context (emergency resources get the shorter,
  calmer script), not by the user. `CallScriptTone` stays in the `AiService` interface.
- **Alternatives:** keep the rainbow (clashed); a single flat olive for all categories (loses the
  category-coded scanability); removing the short tone from the service (would couple emergency
  handling to the UI).
- **Consequences:** category colors are family-constrained — new categories must pick an earth tone;
  map pins/icon chips stay distinguishable mainly via icon + label, color is secondary. The tone
  toggle can return later as a setting if users ask for it.

### 2026-07-10 — Accent: acid lime → true olive `#5F7326` (+ text-grade amber)
- **Status:** accepted (supersedes the lime of [[2026-07-07 Granola Reskin Light Paper Theme]])
- **Context:** User asked for a Granola-feel overhaul with a **muted olive** accent; the lime read
  harsh. A first low-chroma candidate (`#5A6440`) was rejected on device as "grayish".
- **Decision:** `accent #5F7326` — a real olive with visible green chroma — with `textOnAccent`
  flipped to paper-white (5.0:1) and `accentPressed #4C5C1E`. Alongside it, a **`warningText
  #8F5D16`** token: the base amber failed AA (3.4:1) as small text on the trust labels, so
  `STATUS_TONE_COLOR.warning` now uses the text-grade amber while dots/icons keep `#B7791F`.
- **Alternatives:** keep lime (rejected by user); grayer olives (failed on device); lighter olives
  like `#75814B` (fail 4.5:1 with any text color).
- **Consequences:** dark-text-on-accent assumptions are gone; any future accent change must re-check
  `textOnAccent`, accent-on-background, and accent-on-`accentSoft` contrast. Splash/app-icon artwork
  still predates the palette.

### 2026-07-10 — Detail page: action-row pills + call-script bottom sheet (footer removed)
- **Status:** accepted
- **Context:** The pinned Call/Directions footer read like giant nav tabs, and the inline call
  script made the page long. User asked for compact in-page actions and a premium script reveal.
- **Decision:** A compact **`ActionRow`** of auto-sized pills directly **under the header** (Call
  olive-filled · Directions · Save · Share · Call script) — Call stays above the fold, Save moved
  here from the route header (one Save control), Share via the built-in `Share` API. The script
  opens in a new generic **`BottomSheet`** (RN `Modal` + `Animated`, **no new dependencies** —
  `@gorhom/bottom-sheet` would have pulled reanimated + gesture-handler for one sheet). Script
  trigger hidden for phone-less resources.
- **Alternatives:** action row down at the Contact section (rejected — Call would fall below the
  fold); full-width stretched action tiles (shipped first, rejected by user as "extended");
  drag-to-dismiss on the sheet (deferred — needs PanResponder scoped to the grabber; backdrop tap +
  close + Android back is complete).
- **Consequences:** `BottomSheet` and `Skeleton` are reusable primitives; every resource action now
  records/behaves identically from one place; add `KeyboardAvoidingView` to `BottomSheet` the day a
  sheet hosts a text input.

### 2026-07-09 — Official Online Sources widget on the category page
- **Status:** accepted
- **Context:** Veterans need trusted online backup (official forms, guidance, next steps) when local
  opportunities aren't enough — without turning the app into a link library.
- **Decision:** Add a **supporting widget** to each category (Results) page listing **3–5 curated
  official/trusted sources** for that `NeedCategory` — VA.gov, federal pages, state/county veteran-
  service directory pointers, verified nonprofits — each with a **trust badge** and an external link.
  It sits **below** the local cards (and in the empty state); the **local finder stays primary**. Data
  is **curated static** (`src/data/officialSources.ts`, original descriptions + real URLs), labeled by
  trust — no scraping/API, no `Resource`/service-model change.
- **Alternatives:** a separate "Resources" tab/library (rejected — the user wants a supporting widget,
  not a new destination); pulling these into the mock `Resource` list (rejected — they're online
  references, not local opportunities, and shouldn't mix into distance-sorted local results).
- **Consequences:** every category now has an official backstop; the empty Results state is far more
  useful. **State/county entries are generic directory pointers** (NASDVA/NACVSO) — deep-linking by
  ZIP is a later enhancement. Build log: [[2026-07-09 Official Online Sources Widget]].

### 2026-07-09 — First-run is a full account-creation pipeline; profile made concise
- **Status:** accepted
- **Context:** The setup should be a beautiful, first-impression **account-creation flow** (welcome →
  prompts → "Create account"), and the Profile screen was cluttered (tall option rows made it very long).
- **Decision:** Make **`index.tsx` a pure gate** (route to `/onboarding` or `/home`, no UI) and move the
  **welcome into the onboarding flow** as step 0, so a fresh launch opens straight into a cohesive
  pipeline: **Welcome → 5 prompts (progress) → Create account → saved → Home**. New `OnboardingWelcome`
  (brand hero + halo + staggered entrance) and `OnboardingComplete` (success check + recap + "Create
  account") components. The onboarding uses **spacious `row` options**; the **Profile uses compact
  `pill` chips** + tighter spacing — a deliberate density contrast (focused flow vs dense settings).
- **Alternatives:** keep the welcome on `index` as a separate screen (rejected — a single owned
  pipeline gives consistent motion + one file); real accounts/auth (out of scope — "Create account" is
  framing over the on-device profile); keep rows on Profile (rejected — too long/cluttered).
- **Consequences:** the `OptionGroup` `variant` (row/pill) now carries its weight across both surfaces.
  "Create account" saves the local profile (no backend). Build log:
  [[2026-07-09 Welcome Flow and Concise Profile]].

### 2026-07-08 — Extended profile + multi-step setup wizard
- **Status:** accepted (finishes the profile half of [[Phase 8 Saved and Profile]])
- **Context:** The user wanted the app to open into a real account-creation-style setup — multiple
  screens, each with its own prompt — collecting an extended profile. Name + ZIP required; the rest
  optional.
- **Decision:** Rewrite `app/onboarding.tsx` as a **single-route step machine** (Name → ZIP → Role →
  Documents → Radius → Done; no route-per-step) driving a draft saved once at the end. Extend
  `VeteranProfile` with **role, documentsOnHand, preferredRadiusMiles** (all optional; ZIP required in
  the UI but kept optional in the type for tolerant load). Widen `saveDetails` to a `ProfileDetails`
  merge. New shared **`OptionGroup`** (single/multi chip group) + **`TextField`** (removed 4×
  duplication) in `src/components/`, and an `OnboardingStep` scaffold. The **Profile tab becomes one
  always-editable form** reusing those. **Preferred radius wired into search** from both `results.tsx`
  and `ResourceDetail.tsx`.
- **Alternatives:** route-per-step (rejected — pollutes typedRoutes, fragments the draft, breaks the
  `replace` back-stack invariant); a generic config-driven step renderer (rejected — fake complexity
  for 5 heterogeneous steps); reopening the wizard to edit (rejected — wizard owns first-run routing;
  a settings form is the right edit surface); **disability rating** (rejected this pass — too
  sensitive; privacy principle #5).
- **Consequences:** option lists live once in the type files (`ROLE_OPTIONS`/`RADIUS_OPTIONS`/
  `DOCUMENT_OPTIONS`). Role + documents are stored/shown (AI tie-ins later); radius personalizes
  results now. `saveDetails`'s `??` merge can't clear role/radius (documents clear via empty array) —
  acceptable for a form. Build log: [[2026-07-08 Extended Profile Multi-Step Setup]].

### 2026-07-08 — Phase 8: Saved resources (ids, not snapshots; save in the route header)
- **Status:** accepted
- **Context:** Save was deferred through Phases 4–7. Phase 8's profile half already shipped, so this
  is the Save feature. Key choices: what to store, and where the Save controls live.
- **Decision:** New on-device `src/services/saved/` store mirroring profile/activity (AsyncStorage
  key `frontline.saved.v1`, `SavedEntry {id, savedAt}`, `useSaved()`). **Store ids only** and
  re-resolve live via `getById` (so trust signals aren't frozen), **not** resource snapshots. Save
  UI: a **bookmark on the card** (top-row cluster) and a **`headerRight` bookmark on the
  `/resource/[id]` route** (leaves `ResourceDetail` + the sticky footer untouched). Saved tab derives
  its list from `savedIds` over an id-keyed resolve cache, so unsaving removes the row with no flash.
  **Scope: resources only.**
- **Alternatives:** store `Resource` snapshots (rejected — goes stale, violates live-trust);
  Save in the detail footer/meta row (rejected — crowds the primary actions / reads oddly; header is
  the platform-standard spot); a `SavedService` interface (rejected — on-device state, the context is
  the API, like activity).
- **Consequences:** the Saved tab is live; `SavedProvider` nests innermost in `_layout`. Saving
  scripts/checklists and the extended optional profile (role/radius/docs → queries) remain a later
  slice of Phase 8. **Phase 7** marked done (summarizer complete). Build log:
  [[2026-07-08 Phase 8 Saved Resources]].

### 2026-07-08 — Phase 6: deepen the AI, stay templated/offline
- **Status:** accepted
- **Context:** Phase 6 (AI plans + call scripts) was ~80% built in Phase 4. The roadmap's own risk is
  "generic-sounding templates." Decision on direction + which extras.
- **Decision:** Keep the AI **templated/offline** (no real Claude, no proxy, no keys) and make it
  genuinely useful: specific next-step timing via a new `closingTimeToday` helper + walk-in/online
  signals; **personalize the standard call script by first name** (optional `firstName?` on
  `buildCallScript` only — not `Need`/`buildNextStepPlan`); **copy-to-clipboard** (`expo-clipboard`);
  and an **emergency fast-path** — a contact-only urgent Call banner at the top of emergency-category
  detail pages + the call script defaulting to the shorter calm tone.
- **Alternatives:** wire real Claude now (rejected — needs a proxy + keys + infra; out of MVP);
  scaffold a `ClaudeAiService` seam (deferred — no proxy yet); personalize the plan or tailor to the
  veteran's documents (not selected — scope).
- **Consequences:** `AiContentBlock` title is now optional (removed a duplicate heading). New
  `EmergencyCallBanner` component (contact-only, no advice → no AI disclaimer). `expo-clipboard`
  needed a native rebuild. Guardrails unchanged. The real-Claude swap stays a future drop-in behind
  the same `AiService`. Build log: [[2026-07-08 Phase 6 Deepen AI Plans Call Scripts]].

### 2026-07-08 — Polish: category-color layer, tap motion, detail restructure
- **Status:** accepted
- **Context:** User feedback — the UI felt "rigid" on tap, wanted "more color," and the opportunity
  detail page "feels random." (Detail felt long and threw the call script at the user.)
- **Decision:** (1) Add a **category color** to `RESOURCE_CATEGORY_META` + `NEED_CATEGORY_META` (a
  categorization color layer, kept **distinct** from the semantic verified/warning/danger colors so
  meaning is preserved) + a pure `withAlpha` tint helper; apply to icon chips and map pins. (2) Add
  motion with RN `Animated` (**no new dep**): a `PressableScale` for cards and a spring-in for the
  map preview. (3) Restructure the detail page top-down (what it is → what to do → what to bring →
  contact → trust), move the simulated rating into the header, drop the redundant Eligibility section
  and verbose summary lines, and put the **call script behind a "Get a call script" button** that
  auto-generates on reveal.
- **Alternatives:** react-native-reanimated for animation (rejected — native dep + rebuild for a
  light polish; RN `Animated` suffices); full-color category cards (rejected — too busy for the calm
  paper base; colored icon + soft tint only).
- **Consequences:** [[UI Design System]] gains a category-color palette (icons/pins), alongside the
  unchanged semantic colors. Detail page is shorter and clearer. Build log:
  [[2026-07-08 Polish Color Motion Detail Structure]].

### 2026-07-08 — Add a dedicated Map tab (reverses "toggle only, no map tab")
- **Status:** accepted (revisits the Phase 5 "no map tab" decision)
- **Context:** With the map only reachable via Discover → Other → a category → Results → the Map
  toggle (four taps, non-obvious), the user couldn't find it — "I don't see a map anywhere."
- **Decision:** Add a **dedicated Map bottom-nav tab** (`app/(tabs)/map.tsx`) showing **all** located
  opportunities as category pins via `resourceService.listResources()`, reusing `ResourceMap`
  (pins → preview → detail + recenter). Tabs are now **Home · Discover · Map · Saved · Profile**. The
  Results List⇄Map toggle stays for category-scoped searches. `ResourceMap.needCategory` became
  optional (derived per-pin via `resourceToNeedCategory` on the general tab).
- **Alternatives:** a List⇄Map toggle on Discover (rejected — a real tab is more discoverable); a
  "View on map" button (rejected — still buried).
- **Consequences:** the map is one tap from anywhere. Also did a spacing-consistency pass
  (`ui-reviewer`-checked) across Home/Discover/Map — uniform `xl` gutter, `lg` top inset, and the
  Discover shell row now groups with its list. Build log:
  [[2026-07-08 Home Redesign Discover Tab Fullscreen Map]] (follow-up).

### 2026-07-08 — Map location: GPS + ZIP fallback, overlay-only, data stays LA
- **Status:** accepted
- **Context:** The map rendered LA seed pins but had no real location awareness (always centered on
  `SEED_CENTER`). The user wanted it to actually use the veteran's location. Tension: all seed data
  is LA-only, so re-anchoring the map to a real (non-LA) location would show an empty map.
- **Decision:** Add `expo-location` and resolve location as **device GPS with a ZIP fallback**
  (privacy-first, matches [[Map and Search Design]]): permission requested **only on a recenter tap**,
  GPS `Balanced` fix, else geocode the profile ZIP (`geocodeAsync("<zip>, USA")`). Show the blue
  "you are here" dot (`showsUserLocation`, gated on granted) + a floating recenter button. **Keep the
  resource catalog, pins, and card distances anchored to LA** — location is overlay + camera only, it
  does **not** re-anchor data (so the map is always populated; honest, it's the labeled LA demo set).
- **Alternatives:** re-center search on the real location (rejected — empty map outside LA); device
  GPS only, no ZIP (rejected — privacy + no-permission fallback wanted); a `LocationContext`
  (rejected — session-only, single screen; a hook suffices); Google provider for styling (rejected —
  needs an API key; Apple Maps default is fine).
- **Consequences:** New `src/services/location/` seam (thin `userLocation.ts` wrappers +
  `useUserLocation` hook + barrel); `@/lib/geo` stays pure (geocoding is a platform call).
  **Native rebuild required** (`expo prebuild` + `run:ios`) for the Info.plist permission +
  `ExpoLocation` pod. Precise location is never persisted. Build log:
  [[2026-07-08 Map Location GPS ZIP Recenter]].

### 2026-07-08 — Home/Discover redesign: Discover tab, fullscreen map, on-device activity + simulated ratings
- **Status:** accepted (adds product surface beyond the documented MVP)
- **Context:** The user wanted a more polished shape: the map as a real fullscreen view (not a
  widget), a **Discover** tab so all help types aren't a long scroll on Home, and a personalized
  Home with a greeting, a random message, and a "How was ___?" rating feed for opportunities the
  veteran engaged with. This introduces **activity history + community ratings** — new concepts the
  MVP (verification-based trust; Phase 8 saved/profile) didn't have.
- **Decision:** Build it in three architect-reviewed pieces. (1) **Fullscreen map** — the Results map
  view goes edge-to-edge with a floating toggle. (2) **Discover tab** (Home · Discover · Saved ·
  Profile): a shell row (All · Food · Clothes · VA Help · Employment · Other) over all opportunities
  via a new **`listResources(category?)`** browse seam; the category grid moves off Home. (3) **Home
  feed**: greeting + stable-per-day random message + a "How was X?" card driven by a new **on-device
  activity store** (`frontline.activity.v1`, mirroring the profile store) recording engagement when a
  resource is opened/called; 👍/👎 feeds a **deterministic simulated** community rating
  (`src/lib/ratings.ts`, derived from the resource id — no data-model change).
- **Alternatives:** map as a bottom-nav tab (rejected in Phase 5 — chose the toggle); looping
  `search()` for browse (rejected — wrong semantics + 12× latency; added `listResources`); a real
  ratings backend (out of scope — local + simulated); blending the user's vote into the shown average
  (**rejected on honesty grounds** — the vote is shown as a separate fact, the average is labeled
  "simulated (demo)"); an `ActivityService` interface (rejected — on-device state, not a backend seam).
- **Consequences:** New product surface is shipped as an **explicitly-simulated, on-device** demo;
  the verification-based trust model is unchanged and the simulated rating always carries an adjacent
  "simulated (demo)" label. `resourceActions.ts`/`ResourceCard.tsx` stayed pure (recording lives at
  the detail call sites). Engagement log is deduped-by-resource and capped. Build log:
  [[2026-07-08 Home Redesign Discover Tab Fullscreen Map]].

### 2026-07-08 — Phase 5 map: toggle-in-Results, Apple Maps default, no map style / no location dep
- **Status:** accepted
- **Context:** Phase 5 shows the same resources on a map. Three choices: (1) map as a standalone
  bottom-nav tab vs a view of the current result set; (2) how to style the map to the paper theme;
  (3) how to center it.
- **Decision:** (1) Ship the map as a **List⇄Map toggle inside Results** — the design doc's "two
  synchronized views… switching preserves context." Both views share one result set (via a new
  `useResourceSearch` hook) and one lifted `selectedId`; state is local so **typedRoutes is
  untouched** (no new route — the pin preview reuses `/resource/[id]`). (2) **Accept Apple Maps'
  default styling on iOS** — verified via Context7 that Apple Maps ignores `customMapStyle`; a paper
  style would require `PROVIDER_GOOGLE` + a Google Maps iOS key + native rebuild. So **no
  `src/theme/mapStyle.ts`** (it would only style Android and reads as slop). (3) Center by
  **`fitToCoordinates` to the pins** (fallback `SEED_CENTER`) — **no `expo-location`** dependency
  (privacy + scope).
- **Alternatives:** a Map bottom-nav tab (rejected — no category context without its own picker);
  `PROVIDER_GOOGLE` + Maps key for a styled map (rejected — config/entitlement cost + ships a key,
  not worth it for a demo); device GPS via expo-location (rejected — fitting to pins suffices);
  clustering (deferred — only 12 seed resources).
- **Consequences:** custom Ionicon markers must set `tracksViewChanges={false}` after first paint
  (perf). Location-independent resources (null coords, e.g. the Veterans Crisis Line) never get a
  pin — they stay in the list and are surfaced as a count note, with a dedicated empty-map state
  when a category has only such resources. `ResourceMap.web.tsx` keeps web usable (maps is
  iOS/Android only). Build log: [[2026-07-08 Phase 5 Map and Discovery]].

### 2026-07-08 — Phase 4 detail page: defer Save, thread need category, share the Need builder
- **Status:** accepted
- **Context:** Building the resource detail page surfaced three choices. (1) Phase 4's card/detail
  spec lists a Save action, but real saved-resource persistence is [[Phase 8 Saved and Profile]].
  (2) The AI calls need a `Need`, but `getById(id)` returns only a `Resource`, whose `category` is
  the 11-value `ResourceCategory` — not the 12-value `NeedCategory` the AI expects. (3) The default
  `Need` literal already lived inline in `results.tsx` and was about to be copied onto the detail.
- **Decision:** (1) **Defer Save to Phase 8** — no Save button now, so we don't ship a dead stub;
  detail actions are Call · Directions · View details · Generate call script. (2) Carry the
  veteran's original **`NeedCategory` as a route param** (`/resource/[id]?category=…`) from the card,
  falling back to `general_benefits` on a bare deep link — avoids a lossy `ResourceCategory →
  NeedCategory` reverse map. (3) Add **`defaultNeedForCategory(category, zip)`** to `types/need.ts`
  and build the `Need` through it in both `results.tsx` and the detail page.
- **Alternatives:** a minimal AsyncStorage saved store now (rejected — pulls Phase 8 forward,
  out of scope); a reverse category map (rejected — lossy and only cosmetic, since the templated AI
  keys off `resource.category`, not `need.category`); duplicating the `Need` literal (rejected — slop).
- **Consequences:** `StatusPill` was extracted and `STATUS_TONE_COLOR` centralized in
  `resourceStatus.ts` (card + pill + detail trust row read one map). No `NextStepPlan`/`BenefitSummary`
  component files — rendered inline in `AiContentBlock`. Structure pre-approved by
  `react-native-architect`. Build log: [[2026-07-08 Phase 4 Resource Detail Page]].

### 2026-07-07 — Re-skin to a warm light "paper" theme (Granola-inspired)
- **Status:** accepted (supersedes the dark navy direction in [[UI Design System]])
- **Context:** The user wanted Frontline to adopt the look of [granola.ai](https://www.granola.ai) —
  a modern, unconventional aesthetic — specifically its color scheme and font. Granola's 2026 rebrand
  is a warm off-white "paper" background, an acid-lime accent, near-black text, and a slab-serif
  display / neutral-sans body pairing (*Quadrant* + *Melange*).
- **Decision:** Flip the whole theme from dark navy to a warm light **paper** palette
  (`background #F5F1E8`, lime `accent #B5C832`, `textPrimary #1A1A17`) and swap the typeface to
  **Fraunces** (serif, display/title headers) + **Inter** (UI/body). All changes are centralized in
  `src/theme/colors.ts` + `typography.ts` + font loading in `app/_layout.tsx` + `app.json` chrome —
  no per-screen edits, since every screen consumes tokens and renders through `AppText`.
- **Alternatives:** keep dark and only borrow the lime accent (rejected — user wanted the full
  Granola look); a dual light/dark theme (rejected — more scope than asked); use Granola's actual
  fonts (rejected — Quadrant/Melange are proprietary and can't be embedded legally, so the closest
  free Google-Fonts look-alikes were chosen); white text on the lime button (rejected — fails
  contrast at 1.9:1; dark text on lime is 9.4:1).
- **Consequences:** `success` is a **deep emerald `#2E7D32`**, deliberately distinct from the lime
  accent, so the "color has meaning" rule holds (lime = primary action, emerald = verified). All
  text tokens verified WCAG AA on paper. Splash/adaptive-icon **artwork** may still read as dark-era
  and is flagged as a non-blocking follow-up. Font packages swapped in `package.json`
  (`@expo-google-fonts/manrope` → `inter` + `fraunces`). Docs updated: [[UI Design System]].

### 2026-07-07 — Stage 4: drop the guided need-flow screen; set-once details + one-tap resources
- **Status:** accepted (revisits the Phase 3 guided flow)
- **Context:** The user found the app unfriendly — a cramped 2-column home grid, and every category
  forced a multi-question guided flow (urgency/modality/help type/documents/ZIP) before showing any
  help. They wanted details captured once at setup and a category tap to go straight to resources.
- **Decision:** Remove `app/need/[category].tsx` entirely. Capture **first name + ZIP** in the
  one-time setup (ZIP now persisted on the profile). Tapping a category pushes straight to
  `/results`, which builds the `Need` from the category + the profile's ZIP + sensible defaults
  (`urgency: 'this_week'`, `modality: 'either'`, `helpType: 'understand'`, no documents, radius 15).
  Redesign the home screen **warmer**: a time-aware greeting hero + **single-column** category cards
  (icon chip + label + one-line description + chevron), keeping the dark navy base.
- **Alternatives:** Keep the guided flow as an optional "refine" (rejected — user wants immediacy);
  per-category colors or a light theme (rejected — chose warm-within-dark); a radius picker at setup
  (deferred — defaults to 15).
- **Consequences:** The `Need` model and `resourceService.search` are unchanged — only the input
  path changed (defaults + profile instead of a questions screen). Results loses per-search urgency
  tuning (all searches are "this_week" ordering by distance) until optional filters are added later.
  Design docs updated: [[UI Design System]] (warmer direction, single-column cards) and
  [[App Flow|Core User Flows]] (setup captures ZIP; category → resources directly). This revisits the
  Phase 3 [[2026-07-07 Phase 3 Guided Need Flow]] guided-questions approach.

### 2026-07-07 — Onboarding + on-device profile (name only), pulled ahead of Phase 8
- **Status:** accepted
- **Context:** The user wanted the app to feel personal — a one-time setup and a home screen that
  greets them by name. This is the onboarding/profile slice of [[Phase 8 Saved and Profile]], wanted
  now rather than after the documented Phase 4 (resource detail pages).
- **Decision:** Build it as its own step. Introduce the app's **first persistence layer**
  (`@react-native-async-storage/async-storage`, the documented Phase 8 choice) behind a small typed
  store (`src/services/profile/profileStorage.ts`), and the app's **first shared state** as a light
  React Context (`ProfileProvider` / `useProfile`) so the greeting updates reactively and returning
  users are recognized on launch. Collect **first name only** — nothing sensitive. Greeting is
  **time-aware** (`src/lib/greeting.ts`). Profile tab gains edit + reset.
- **Alternatives:** A full service-singleton seam like `resources`/`ai` (overkill for reactive UI
  state); per-screen AsyncStorage reads with `useState` (greeting would flash / not stay in sync);
  a global state library (explicitly out of MVP scope).
- **Consequences:** `VeteranProfile` starts minimal (`firstName`, `onboardingComplete`, `createdAt`)
  and is forward-compatible — Phase 8 can add optional ZIP/role/radius/documents to the same store
  and extend `useProfile` without a rewrite. `index.tsx` is now a hydration-gated first-run router.
  Typed routes must be regenerated (Metro start) whenever a top-level route file is added.

### 2026-07-07 — Phase 2 service-interface shapes
- **Status:** accepted
- **Context:** [[Resource Data Model]] sketched `ResourceService.search` returning `Resource[]` and
  `AiService.summarizeBenefit({ text })`. Building Phase 2 surfaced two better shapes.
- **Decision:** `search` returns **`ResourceSearchResult[]`** (`resource` + query-derived
  `distanceMiles` + `isOpenNow`) so the UI doesn't recompute; `summarizeBenefit` takes
  **`{ resource }`** (the app always holds a `Resource`) instead of raw text.
- **Alternatives:** return bare `Resource[]` and derive distance/open-now in every screen (duplication);
  keep the raw-text summarizer (no caller needs it yet).
- **Consequences:** screens consume ready-to-render results; the real Claude implementation still
  fits behind the same interface. Docs updated to match.

### 2026-07-07 — Reframe to Frontline
- **Status:** accepted
- **Context:** The previous product was scrapped. A new product, **Frontline**
  (a veteran benefits/resource navigator with AI embedded in workflows), replaces it. The repo's
  development framework (agents, hooks, rules, skills, MCP, Obsidian, workflow) and the reusable
  RN+Expo design system are worth preserving.
- **Decision:** Do a **documentation + framework + config reframe** — rewrite the Obsidian brain and
  `CLAUDE.md` for Frontline, rename app config to `com.frontline.app`, delete legacy historical
  records, and preserve the framework and design system. **Feature screens are not rewritten yet**;
  they are the first coding milestone ([[Phase 2 Resource Data Model and Service]]).
- **Alternatives:** (a) start a brand-new repo — loses the mature framework; (b) rewrite all code
  now — too big, unreviewable, and premature before the product docs settle.
- **Consequences:** The running app keeps its legacy *screens* until Phase 2–5 rebuild them; only
  its native identity is now Frontline. The `ios/` native project must be regenerated.

### 2026-07-07 — AI is interface-first, templated before real
- **Status:** accepted
- **Context:** Frontline's core AI (next-step plans, call scripts, benefit summaries) must be
  "embedded in workflows, not a chatbot" — but a mobile client can't safely hold an LLM API key.
- **Decision:** Define a typed **`AiService`** interface consumed by screens. Ship a **templated**
  (offline, deterministic) implementation for the MVP; wire the real Claude API behind the same
  interface later, via a **server-side proxy**. See [[AI Feature Design]].
- **Alternatives:** call Claude directly from the client (leaks the key; needs a backend anyway);
  mock-only forever (kills the "real AI" value).
- **Consequences:** MVP is fully demoable offline; a proxy/backend is a prerequisite before any real
  LLM call ships ([[Phase 10 Backend and Data Ingestion]], [[Environment Variables]]).

### 2026-07-21 — Real community ratings replace the simulated rating
- **Status:** accepted
- **Context:** A `simulatedRating()` helper showed deterministic fake stars (3.8–4.8) on every
  resource detail — even with the real backend live — so simulated data leaked into the production
  experience. That violates "trust by verification / no simulated data shown as real."
- **Decision:** Delete the simulated rating. Add a **real thumbs rating** aggregated across devices via
  the backend (`resource_votes` table + deny-all + two `SECURITY DEFINER` RPCs), shown as
  **"N of M found this helpful,"** starting at **0** and growing as veterans vote. Keyed to the
  existing anonymous device UUID (no login/PII). Offline (no backend) honestly shows 0.
- **Alternatives:** (a) 1–5 star average — more subjective, needs a new vote control; (b) on-device
  only — never accumulates across users, so the count is meaningless.
- **Consequences:** Migration `0009_resource_votes.sql` must be pushed before ratings work live. The
  veteran's own vote stays on-device (ActivityContext) for button state + the review prompt; the
  shared count is server-authoritative. See [[2026-07-21 College Scorecard plus Real Ratings and Simulated-Data Purge]].

### 2026-07-22 — Strict veteran-relevance (drop all general-public data)
- **Status:** accepted
- **Context:** After ingesting real national data, most of it was **general-public, not veteran-specific**
  — College Scorecard loaded every college (incl. a beauty institute), HRSA every community clinic,
  LSC every legal-aid office, SAMHSA every treatment facility. For a veterans' app this is noise that
  breaks trust.
- **Decision:** Every resource must be **veteran-specific** (exists to serve veterans) OR offer a
  **concrete veteran benefit**. Enforce at ingest with a NOT NULL `veteran_relevance` column
  (`veteran_specific` | `veteran_benefit`) so general data can never silently return; the DB is
  veteran-only by construction (no runtime filter). **Kept:** VA facilities (specific), USAJOBS
  (veterans' preference). **Replaced:** College Scorecard → **GI-Bill-approved schools only** (VA GI
  Bill API + ZIP-centroid geocode). **Dropped:** HRSA, HUD counseling, LSC, SAMHSA (its veteran filter
  proved unreliable on re-test). **Referrals:** veteran-specific national referrals (VA homeless line,
  HUD-VASH/GPD/SSVF, VA-accredited legal, VTS/DAV, Caregiver line, Vet Centers, Crisis Line) fill the
  categories with no clean per-place veteran dataset.
- **Alternatives:** (a) keep general safety-net veterans *can* use — reintroduces the exact noise;
  (b) per-place harvest of GPD/SSVF/CVSO — verified live to be **single-state ArcGIS layers only** (no
  national dataset exists), so those are referrals, not pins.
- **Consequences:** DB shrinks from ~47k to a veteran-only set (VA + USAJOBS + GI-Bill schools +
  veteran referrals). Migrations `0011`/`0012`. See
  [[2026-07-22 Veteran-only data rebuild]].

### 2026-07-24 — Hybrid relevance: veteran-first, labeled general backfill (supersedes 2026-07-22)
- **Status:** accepted (user decision during the final data-cycle audit)
- **Context:** The strict rule left **7 of 11 categories with 1–4 national hotlines** and nothing
  local — a veteran searching "food" or "legal" near them found no place to actually go. Abundance
  and strict veteran-only were in direct conflict.
- **Decision:** **Veteran resources always come first; thin categories are backfilled with
  high-quality general sources clearly labeled.** A third `veteran_relevance` tier — `general` —
  is allowed (migration `0013`, column stays NOT NULL). Veteran-first is enforced as **capacity and
  tie-breaks, not display shuffling**: the `search_resources` per-category cap fills veteran rows
  before general (`0014`), relevance breaks distance ties client-side, and the visible sort stays
  nearest-first (a vet needing food today wants the nearest pantry). General rows show a muted
  "Open to everyone" badge; national veteran hotlines render in a dedicated "National help lines"
  strip above local results instead of sorting last on a null distance.
- **Sources:** restored LSC legal aid (854, `legal`) and HUD counseling (~1.3k, `housing`) as
  `general`; added **SSVF grantees** (235, `veteran_specific`, from the VA FY26 XLSX → curated
  JSON) and **Vet Center cross-listing** into `community_support`; the **Feed America
  HSDS feed** for `food` (aggregator → `directory`/`needs_review`, CC BY-SA attribution,
  taxonomy-filtered to real food distribution). **Food scope (user, 2026-07-24): 8
  veteran-dense states** — TX,FL,CA,VA,NC,GA,AZ,PA (~100k rows); national (~310k rows,
  DB ≳500MB) deferred to a Supabase-tier decision. HRSA/SAMHSA stay out (healthcare already
  has 1,816 VA facilities; 37k general rows would drown the veteran identity).
- **Also decided:** GI Bill school pins move from **ZIP centroids to Census-geocoded street
  addresses** (`0015` cache; unmatched = no pin, never approximate); `last_checked` semantics are
  now honest ("From official VA/gov data · updated <date>"; curated lists carry their real
  human-review date); refresh runs on GitHub Actions cron with a freshness gate that fails loudly.
- **Consequences:** Migrations `0013`–`0015`; the "veteran-only by construction" claim becomes
  "veteran-first by construction". Marketing line: every resource is either veteran-specific,
  a veteran benefit, or clearly labeled open-to-everyone.

### 2026-07-24 — Education = veteran-focused schools only (not every GI-Bill college)
- **Status:** accepted (user decision)
- **Context:** The GI Bill Comparison Tool lists ~12.8k approved schools — i.e. nearly every
  college in the US that accepts the benefit. In a veterans' app that reads as bloat: "any college"
  is not a veteran resource.
- **Decision:** Keep only schools that **materially do more for veterans than accept the benefit** —
  Yellow Ribbon funding (extra tuition beyond the GI Bill cap), an organized **Student Veteran
  Group**, or **VET TEC**. Filter lives in `isVeteranFocused()` in `vaGiBillSchools.ts`, so the
  monthly refresh stays consistent. Weaker signals (Principles of Excellence = compliance, 8 Keys =
  a pledge) are excluded. Result: **12,854 → 2,794** (1,096 public / 1,340 private nonprofit / 358
  for-profit). Purged 10,060 rows + provenance.
- **Alternatives considered:** Student Veteran Group only (~1,372, stricter); add 8 Keys (~3,800,
  broader). The chosen middle keeps every school with a real veteran community OR extra veteran
  funding.
- **Also fixed here:** a long-standing `describe()` case bug — VA `type` is upper-case, compared
  against lower-case, so *every* school read "private for-profit"; now correctly typed.
- **Consequences:** education drops to a genuinely veteran-supportive set comparable in size to the
  other real categories. See [[2026-07-24 Data cycle final audit and hybrid rebuild]].

### 2026-07-24 — Trim general backfill to protect the veteran niche
- **Status:** accepted (user decision)
- **Context:** After the hybrid rebuild, the DB was **95% general data** by volume — food
  (116,500 Feed America pantries) alone was 93% of all rows. That shifts Frontline from a
  veteran app to a general safety-net finder. Test for a general source: veterans must
  disproportionately need it AND there must be a concrete veteran-program tie-in.
- **Decision:** **Drop food (Feed America) and legal (LSC)** general sources; **keep HUD housing**.
  Food = generic pantries, no veteran tie-in, overwhelming volume → gone (reverts to the VA
  food/basic-needs referral). Legal = general civil aid; veterans' real legal needs (discharge
  upgrades, VA claims) are already covered by the veteran-specific referrals (Stateside Legal,
  VA-accredited) → gone. HUD stays: HUD-VASH is a veteran voucher program and homelessness is a
  signature veteran issue, and veteran SSVF still ranks above it. Result: DB **124,737 → 7,383**
  rows, now **82% veteran / 18% general** (general = HUD housing only). Adapters
  `feedAmericaFood.ts` + `lscLegalAid.ts` deleted; de-registered from `run.ts`, `refresh.sh`,
  `freshnessGate.ts`.
- **Principle going forward:** the bar for a general source is "does it really apply to veterans,"
  not "is the data available." Keeps the app in its niche. See
  [[2026-07-24 Data cycle final audit and hybrid rebuild]].

### 2026-07-24 — Scoped food + real-veteran-legal plan (refines the niche trim)
- **Status:** accepted (user decision)
- **Context:** After trimming general data, several categories were too thin to give real benefit.
  Diagnosis: the data is **bimodal** — 6 categories have strong veteran data (~7,400 real
  resources), 5 are referral-only. The thin 5 differ: emergency (crisis line) is *correct* thin;
  legal is fixable with real veteran data; food/clothing have no veteran dataset.
- **Decisions:**
  - **Food — scoped general re-add.** Veterans face food insecurity and no veteran-specific food
    dataset exists, so bring back Feed America (8 states) but **cap to the nearest ~20 general
    pantries per search** in the client (`DENSE_GENERAL_CAPS`), badged "Open to everyone", veteran
    food referral always shown. Useful without flooding the veteran feed (the earlier 116k-dominates
    problem is a display cap, not a purge).
  - **Legal — enrich with real veteran data.** Ingest the **VA-accredited representatives**
    directory (attorneys, claims agents, VSO reps — accredited to help veterans with VA claims).
    It's downloadable only via the VA's browser Excel export (no API/bulk URL), so it follows the
    **SSVF pattern**: manual export → committed file → adapter, quarterly refresh. Pending the
    export file.
  - **Keep all categories.** Thin ones lead with the veteran referral + the AI next-steps layer —
    the real differentiator vs a generic 211 directory, not raw volume.
- **Principle:** real veteran data where it exists + a clear next step everywhere. See
  [[2026-07-24 Data cycle final audit and hybrid rebuild]].

### 2026-07-24 — VSO reps for legal + strict radius + statewide veteran section
- **Status:** accepted (user decision)
- **VSO representatives (legal):** ingested the VA-accredited VSO representatives (7,759 with a
  placeable ZIP, of ~8.7k) as `legal` / `veteran_specific` — real veteran legal help (free VA
  claims assistance), replacing the dropped general LSC source. Manual export → committed JSON →
  adapter (SSVF pattern), placed at ZIP centroid (the list has city/state/zip, no street). Legal
  now shows VSO reps within radius; legal category copy updated accordingly.
- **Strict radius (all located results):** every located result must be geographically WITHIN the
  search radius — the `search_resources` RPC drops anything beyond it, and rows with an address but
  no coordinates (un-geocoded schools/jobs) too. (Migrations 0019→0021; final form splits
  located-vs-referral so each half uses its index and stays fast on the 7.7k legal rows.)
- **Statewide & national veteran section:** veteran resources with NO pinpoint (SSVF providers,
  crisis/benefit hotlines — null coords AND null address) would vanish under strict radius, so they
  are kept and rendered in a separate clearly-labeled section BELOW the local results, honestly
  marked statewide/national — never mixed into "within radius." SSVF is **state-filtered**
  (`state:XX` tags + `src/lib/zipState.ts` derives the veteran's state from their ZIP) so it isn't
  out-of-state noise. General no-coord rows never appear.
- **Rationale:** honors "nothing shown extends past the radius" while keeping genuinely veteran
  help (SSVF housing, crisis line) reachable and relevant. See
  [[2026-07-24 Data cycle final audit and hybrid rebuild]].

## Related

[[Technical Architecture]] · [[AI Feature Design]] · [[Non-MVP Ideas]] · [[Frontline Command Center]]
