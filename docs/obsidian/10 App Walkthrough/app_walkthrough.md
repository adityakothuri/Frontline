---
tags: [walkthrough, source-of-truth, living-doc]
status: living
updated: 2026-07-11
---

# App Walkthrough

This file explains how **Frontline** works as the codebase grows. It is **not just a changelog** — it
is a guided explanation of how the app actually works, so you can understand the codebase without
digging through files blindly. Update it after every moderate or meaningful change.

> **Reset on 2026-07-07 for the reframe to Frontline.** The **reused design system + app
> shell**, the **data/AI service layer** (Phase 2), and the **guided need flow** (Phase 3) are real
> Frontline. The legacy feature screens have been **removed**. Resource detail pages, AI
> call scripts/summaries, and the map arrive in Phases 4–7.

## How to use this file

Each feature entry explains: purpose · user flow · important files · how the code works · data flow ·
temporary/demo parts · future improvements. Read it to understand the app without opening every file.

## When Claude MUST update this file

After any **moderate or meaningful** change: new screen · feature folder · user flow · state logic ·
service/AI logic · data schema · navigation change · design-system implementation · reusable
component pattern · important refactor · a bug fix that changes a flow. Not for typos or formatting.

---

## What exists today (real, reused)

### Design system — `src/theme/`
- **Purpose:** one source of visual truth. `colors` (warm light "paper" palette, Granola-inspired —
  `background #F5F1E8`, olive `accent #5F7326`, near-black text; semantic `success`/`warning`/`danger`
  = verified/unverified/emergency, with `success` a deep emerald kept distinct from the olive accent),
  `spacing` + `radii`, `typography` (**Inter** for UI/body + **Fraunces** serif for display/title,
  loaded in `app/_layout.tsx`), aggregated in `index.ts` as `theme`.
- **Reuse:** product-agnostic; every screen consumes these tokens and text renders through `AppText`,
  so the theme swap needed no per-screen edits. Prefer these tokens over inline styles.

### Generic components — `src/components/`
- `ScreenContainer`, `AppText`, `Card`, `PrimaryButton`, `Chip`, `ScreenHeader`, `EmptyState`,
  `ErrorState`, `Loading` — reusable primitives that depend only on the theme.

### App shell — `app/`
- `expo-router` file-based routing; `_layout.tsx` (root stack + font/splash gate), `(tabs)/_layout.tsx`
  (bottom tabs), a `loading | error | ready` screen pattern. The **navigation mechanics** are reused;
  the **tab set and screens** become Frontline as feature phases land.

### App config
- `app.json` / `package.json` now identify the app as **Frontline** (`com.frontline.app`, slug/scheme
  `frontline`). The native `ios/` project is regenerated from this config.

## Data & AI service layer — `src/types`, `src/services`, `src/lib` (Phase 2, real)

The foundation the UI builds on. Screens will depend on these **interfaces**, never on the
concrete mocks — so mock → real backend/AI is a drop-in later.

- **Domain types** — `src/types/resource.ts` (canonical `Resource` + category meta),
  `src/types/need.ts` (the `Need` from the guided flow + the 12 need categories, urgency/modality/
  help-type/document enums, label maps). Category colors in both meta maps are **variants within the
  olive/earth family** (2026-07-10 — one distinct earth tone per category, emergency alone rust-red)
  and must stay in sync per category across the two files. See [[Resource Data Model]].
- **Utilities** — `src/lib/geo.ts` (Haversine `distanceMiles`, `formatDistance`) and
  `src/lib/hours.ts` (`isOpenNow`, returning `true|false|null`).
- **Resources service** — `src/services/resources/`. `ResourceService` interface (`search`,
  `getById`); `mockResourceService` implements it over `seedResources.ts` (12 **simulated** LA-area
  veteran resources, honestly labeled). `search` filters by need→category, radius, and modality,
  derives distance + open-now per result, and sorts (for "today": open-now → nearest → verified).
  Consumed via the singleton `resourceService`. Data flow: `Need` → `resourceService.search` →
  `ResourceSearchResult[]` → (future) list/map screens.
- **AI service** — `src/services/ai/`. `AiService` interface (`buildNextStepPlan`,
  `buildCallScript`, `summarizeBenefit`) with a deterministic **templated** implementation
  (`templatedAiService`, offline, category-specific, hedged, disclaimer on every output). Consumed
  via the singleton `aiService`. A real Claude-backed implementation swaps in behind the same
  interface later (via a proxy — keys never in the client). See [[AI Feature Design]].
- **What's mock vs production:** all resource data is simulated; all AI is templated. Both are
  labeled. The **interfaces** are production-shaped.

## Home + resource discovery — `app/`, `src/features/resources` (Stage 4, real)

The core loop. **User flow:** open app → (first launch) one-time setup → **personal Home** →
**Discover** (browse) → **tap a category/opportunity → nearby resources** → Call / Directions →
back on Home, **rate what you tried**.

> The 2026-07-08 redesign split Home (personal landing) from **Discover** (browse), made the map
> fullscreen, and added an on-device activity/rating feed. History: [[Decision Log]] ·
> [[2026-07-08 Home Redesign Discover Tab Fullscreen Map]]. Stage 4 (2026-07-07) had earlier replaced
> the Phase 3 guided need-flow with set-once details; the `Need` model + services are unchanged.

- **Home** (`app/(tabs)/home.tsx`) — a personal landing (no category grid; that moved to Discover):
  a time-aware greeting (`Good [time], [name]`) + a **stable-per-day random** message
  (`src/lib/homeMessages.ts`) + either a **`ReviewPrompt`** ("How was X?" 👍/👎 for the most recent
  unrated opportunity) or a **"Nothing to see here"** empty state with an **Explore help** button →
  `router.navigate('/discover')`. Body gated on activity hydration to avoid a flash.
- **Discover** (`app/(tabs)/discover.tsx`) — browse opportunities: a **`LocationButton`** top-left
  (ZIP / "Set location" → Profile) + a pinned **icon shell row** (`CategoryShells`: All · Food ·
  Clothes · VA Help · Employment · Other over `Chip`, each with an icon; `flexGrow:0` so the row
  can't stretch) over a `FlatList` of `ResourceCard`s from **`resourceService.listResources(category?)`**.
  `All` shows everything; a shell filters via `needToResourceCategories`; **Other** shows the full
  12-category grid (`NeedCategoryCard`) plus a **Miscellaneous** entry (uncategorized API items →
  "Nothing here yet" for now). Cards thread the shell's `NeedCategory` (or
  `resourceToNeedCategory(resource.category)` for All) to the detail page.
- **Results** (`app/results.tsx`) — reads the `category` param + the profile's `zip` (via
  `useProfile()`), builds a `Need` with `defaultNeedForCategory`, and runs the search through the
  **`useResourceSearch(need)`** hook (`{ state, reload }`). Renders loading/error/empty, else a
  header row (result count + **`ViewToggle`**) over a **List⇄Map** view of one shared result set
  (local `view` + `selectedId` state). Empty-state action → **Update location → `/profile`**.
  Data flow: `category + profile.zip` → `Need` → `useResourceSearch` → `ResourceSearchResult[]` →
  `ResourceCard`s (list) **or** `ResourceMap` pins.
- **`OfficialSourcesWidget`** (`src/features/resources/`, curated `src/data/officialSources.ts`) — a
  supporting "Official online sources" widget below the local cards (and in the empty state): 3–5
  trusted online backups per `NeedCategory` (VA.gov, federal, state/county directory pointers,
  verified nonprofits) with a **trust badge** + external link (`Linking.openURL`). The local finder
  stays primary; not shown over the fullscreen map. State/county are generic directory pointers for
  now (ZIP-based deep-linking is a later enhancement).
- **`ResourceCard`** (`src/features/resources/`) — category, distance, **open-now** pill,
  description, **source/verification badge** (green verified / amber unverified-or-stale), and real
  **Call** (`tel:`) + **Directions** (maps deep link) actions. The whole card is now **pressable →
  `/resource/[id]`** (carries `?category=` for AI context) with a "View details ›" affordance.
  Helpers in `resourceStatus.ts` (incl. the shared `STATUS_TONE_COLOR`); device actions in
  `resourceActions.ts`; the open-now dot is the extracted `StatusPill`.
- **Navigation** — tabs are **Home · Discover · Map · Saved · Profile**; `results` **and
  `resource/[id]`** push on top with a shared themed header (factored `themedHeader` const in
  `_layout.tsx`). Saved and Profile are both live.
- **Saved store** (`src/services/saved/`, Phase 8) — the app's third on-device store, same pattern:
  key `frontline.saved.v1` holding `SavedEntry {id, savedAt}` (newest-first). `useSaved()` →
  `{ isHydrated, savedIds, isSaved, toggleSave }`; `SavedProvider` innermost in `_layout`. A
  **bookmark** toggles save on the `ResourceCard` (top-row cluster); on the detail page Save lives
  in the **`ActionRow`** (2026-07-10 — the route-header bookmark was removed so there is exactly one
  Save control). The **Saved tab** (`app/(tabs)/saved.tsx`) derives its list from
  `savedIds` over an id-keyed resolve cache (`getById`) — **ids not snapshots**, so trust signals
  stay live; unsaving removes the row with no re-fetch flash.
- **Activity store** (`src/services/activity/`) — the app's second on-device store, mirroring
  `profile`: one versioned key (`frontline.activity.v1`) holding **engagements** (deduped by
  resource, capped) + **ratings**. `useActivity()` → `recordEngagement` / `rate` / `getRating` /
  derived **`pendingReview`**. `ActivityProvider` wraps the app inside `ProfileProvider`.
  `ResourceDetail` records `'viewed'` on open and `'called'`/`'directions'` on the action-row pills —
  this is what feeds Home's `ReviewPrompt`. The 👍/👎 vote is the veteran's **own** on-device vote
  (drives button state + the review prompt).
- **Ratings service** (`src/services/ratings/`, 2026-07-21) — the **real community rating** that
  replaced the deleted `simulatedRating`. `RatingsService` (factory keyed on `supabaseConfig`, like
  resources/ai): `SupabaseRatingsService` calls the `get_resource_rating` / `submit_resource_vote`
  RPCs (backend `resource_votes` table, deny-all, `SECURITY DEFINER`); `LocalRatingsService` returns
  an honest **0** offline. `<ResourceRating>` shows **"N of M found this helpful"** + thumbs; a vote is
  recorded locally (ActivityContext) *and* submitted to the shared aggregate (keyed to the device
  UUID). Starts at 0, grows as veterans vote — never simulated. See [[Decision Log]].
- **What's mock:** with a backend configured, resources + ratings are **real**; offline they fall back
  to the labeled seed set / 0 counts. AI is templated until the Claude proxy is deployed.

### Resource detail page — `app/resource/[id].tsx`, `src/features/resources` (Phase 4, real)

Tapping a card opens the full page. **Route** (`app/resource/[id].tsx`) reads `id` + `category`,
calls `resourceService.getById(id)`, and shows loading / **not-found** / ready (renders
`<ResourceDetail>`). Both `results.tsx` and this page build their `Need` via the shared
`defaultNeedForCategory(category, zip)` in `types/need.ts`.

- **`ResourceDetail`** — the composition hub. On mount it eagerly loads the **benefit summary**
  (`aiService.summarizeBenefit`) and **next-step plan** (`aiService.buildNextStepPlan`); renders
  top-down: header (with rating) → **emergency banner (if any)** → **`ActionRow`** → AI summary →
  next steps → checklist → contact → trust. (The old pinned Call/Directions footer and inline call
  script were replaced 2026-07-10 — see [[Decision Log]].)
- **`ActionRow`** (2026-07-10) — every action in one compact pill cluster under the header:
  **Call** (olive-filled) · **Directions** · **Save** (owns `useSaved` state) · **Share** (built-in
  `Share` API) · **Call script** (hidden when the resource has no phone). Auto-sized wrapping pills,
  ≥44pt; `ResourceDetail` passes `onCall`/`onDirections` so `recordEngagement` wiring stays with the
  page.
- **`AiContentBlock`** — presentational chrome that sets AI apart with an "AI-generated — verify with
  the source" label + a **skeleton** loading slot (no data of its own; **title optional**). Wraps the
  summary, plan, and call script. Since 2026-07-11 (user feedback) the tag is the block's **only**
  label — the longer not-advice disclaimer footer was removed as redundant per block (the service
  contract still returns `disclaimer`; the UI just doesn't repeat it).
- **`DocumentChecklist`** — "What should I bring?" checkable rows from `documents_needed` (local
  state, not persisted).
- **`CallScriptCard`** — auto-generates **one script** (`aiService.buildCallScript`) with tips, a
  **Copy** button (`expo-clipboard`), and **name personalization** (greets by `profile.firstName`).
  The tone is not a user choice (2026-07-10 — the standard ⇄ "keep it simple" toggle was removed):
  `ResourceDetail` passes `tone` down, `short` for emergency resources, `standard` otherwise.
  `CallScriptTone` remains in the `AiService` interface.
- **`CallScriptSheet` + `src/components/BottomSheet.tsx`** (2026-07-10) — the script opens in an
  animated **bottom sheet** (RN `Modal` + `Animated`, no new deps: slide-up + backdrop fade,
  exit-animation-before-unmount, Android back, safe-area, inner scroll, reduce-motion). The card
  mounts only while the sheet is open, so generation stays opt-in. `BottomSheet` is generic —
  reusable for any future sheet.
- **`src/components/Skeleton.tsx`** (2026-07-10) — generic opacity-pulse placeholder (native driver,
  loop stopped on unmount, hidden from screen readers). Used by `AiContentBlock` and Results'
  card-shaped loading state.
- **`EmergencyCallBanner`** (Phase 6) — for `category === 'emergency'`, a prominent **contact-only**
  urgent Call card at the top (danger treatment, no advice → no AI disclaimer).
- **AI depth (Phase 6, templated):** next-step timing is specific — "call before [closing time]
  today" (`closingTimeToday` in `@/lib/hours`), walk-in/appointment, online-only. Still offline; a
  real Claude impl swaps in behind the same `AiService` later.
- **What's mock:** AI is templated. Why `category` is threaded through the route:
  `Resource.category` (`ResourceCategory`) ≠ `Need.category` (`NeedCategory`), so the veteran's
  original need category is carried explicitly. See [[Decision Log]].

### Map view — `src/features/resources/ResourceMap*` (Phase 5, real)

A **List⇄Map toggle inside Results** (not a tab): `ViewToggle` flips a local `view` state; both views
render the same `useResourceSearch` results and share a lifted `selectedId`, so switching preserves
context. State is local — **no new route, typedRoutes untouched**. In map view the map is
**fullscreen** (edge-to-edge under the header, `results.tsx` renders it outside `ScreenContainer`
padding) with the `ViewToggle` floating over it.

- **`ResourceMap.tsx`** — `react-native-maps` `MapView` with **category Ionicon markers** (category
  colors) for located resources; first paint centers on the first pin (US-center `FALLBACK_REGION`
  only if none), then `fitToPins` on `onMapReady`; `tracksViewChanges={false}` after first paint for
  perf. Tap a pin → `ResourcePreview`. Resources with **null coords** (phone/online-only, e.g. the
  national referrals + Veterans Crisis Line) get no pin — shown as a count note, or a full "Phone &
  online only" empty state if a category has only those.
- **Map controls** — a bottom-right cluster: **+/− zoom buttons stacked above the recenter**. Zoom
  scales the live region (`regionRef` kept fresh by `onRegionChangeComplete`, clamped `MIN_DELTA`…
  `MAX_DELTA`). Recenter is **ZIP-first**: it resolves the profile ZIP's centroid from the backend
  `zip_centroids` table (`resolveZipCentroid` — the exact source `search_resources` uses), falls back
  to the OS geocoder (`geocodeZip`), then to **device GPS** only when no ZIP is set. This fixed the bug
  where GPS (a simulator/stale fix) recentered to the wrong city.
- **Location (`src/services/location/`)** — `showsUserLocation` (blue dot, gated on granted).
  `useUserLocation(zip)` wraps `expo-location`; `geocodeZip` resolves a ZIP → coords. Permission is
  requested only on a GPS fallback, never persisted. Needs a native build (Info.plist permission via
  the `expo-location` config plugin). See [[Decision Log]].
- **`ResourceMap.web.tsx`** — placeholder (maps is iOS/Android only; Metro auto-resolves `.web.tsx`).
- **`ResourcePreview.tsx`** — compact overlay card → `/resource/[id]?category=`.
- **Map tab** (`app/(tabs)/map.tsx`) — located resources **near the profile ZIP** as pins, no
  category scope. (Browse is radius-scoped as of 2026-07-20 — before that it plotted every resource
  nationwide, which broke once real data scaled past the demo seed; see
  [[2026-07-20 Browse tabs show nationwide results ignoring ZIP]].) Since
  2026-07-10/11 the map sits in a **framed rounded card** (margins, hairline border, whisper shadow)
  under a proper header, with a **category legend strip** above it (one tinted pill per pinned
  category — its olive-family color, icon, and count; skeleton pills while loading, fixed-height
  slot so nothing reflows) and an **olive footer pill** below ("N places nearby — tap a pin to
  preview"). Motion follows the onboarding pattern: one driver staggers header → frame → footer on
  entry, a second fades the legend/map/count in when results land, both honoring reduce-motion; the
  map recenter button is a `PressableScale`. Results' fullscreen map view is unchanged.
- **What's mock:** resource data is still seeded. **Map styling:** iOS uses Apple Maps' default
  (Apple ignores `customMapStyle`; no Google key added) — see [[Decision Log]]. No `expo-location`
  (centers by fitting to pins).

## Onboarding + profile — `app/onboarding.tsx`, `src/services/profile` (real)

The app's persistence + personalization. **Why it exists:** to make Frontline feel personal and to
capture the veteran's details **once** via a real account-style setup. Privacy-first: name + ZIP
required, a few optional preferences, on-device, nothing sensitive.

- **Profile store** (`src/services/profile/`) — the app's first persistence + shared state.
  `profileStorage.ts` wraps AsyncStorage (versioned key, **tolerant** field-by-field load — legacy
  profiles missing the new fields still load); `ProfileContext.tsx` exposes `useProfile()` →
  `{ profile, isHydrated, saveDetails, resetProfile }`. `VeteranProfile` (`src/types/profile.ts`) =
  `firstName`, optional `zip`, **`role?`**, **`documentsOnHand?`**, **`preferredRadiusMiles?`**,
  `onboardingComplete`, `createdAt`. **`saveDetails(details: ProfileDetails)`** merges (provided key
  overwrites, omitted untouched), preserves `createdAt`, sets complete.
- **First-run gate** (`app/index.tsx`) — unchanged; returning users → Home, first-timers → welcome →
  `/onboarding`.
- **Setup wizard** (`app/onboarding.tsx`) — a **single-route step machine + draft**: Name (req) → ZIP
  (req, 5 digits) → Role → Documents (multi) → Radius → Done. Required steps gate Continue; optional
  steps **Skip for now**; Back revises; finish saves the draft once → `replace('/home')`. Uses the
  shared **`OptionGroup`** + **`TextField`** (`src/components/`) and the **`OnboardingStep`** scaffold
  (`src/features/onboarding/`, progress + prompt + footer). Option lists come from the type files
  (`ROLE_OPTIONS`/`RADIUS_OPTIONS`/`DOCUMENT_OPTIONS`).
- **Profile tab** (`app/(tabs)/profile.tsx`) — split into **view/edit modes** 2026-07-11 (was one
  long summary-plus-form screen). **View (default):** shared `ScreenHeader` with a round **pencil
  `HeaderButton`** in its new trailing `action` slot (`src/components/ScreenHeader.tsx`), a centered
  **avatar** hero (initial in an olive-ringed circle, name, role), and one **at-a-glance card**
  (ZIP / search radius / document names via `documentsSummary` — "DD-214, VA card +1 more"), with
  **Reset setup** + a privacy note pinned to the bottom (scrolls only if large text overflows;
  `flexGrow: 1` keeps the pin). **Edit (pencil):** the form (name/ZIP `TextField`s + the three
  `OptionGroup`s), Save (gated on name + 5-digit ZIP; failure alert keeps the draft), and an **X**
  that confirms "Discard changes?" only when the draft is dirty. State lives locally in the screen;
  a `useEffect` re-syncs the draft whenever the stored profile changes.
- **Personalization** — `preferredRadiusMiles` flows into `defaultNeedForCategory` from both
  `results.tsx` and `ResourceDetail.tsx`, so search honors the chosen radius.
- **What's mock:** nothing — real on-device storage. **Extend later:** wire role/documents into the
  AI/what-to-bring; disability rating deliberately omitted (sensitive).

## Trust & verification layer — `src/features/resources`, `src/components` (Phase 9, real)

Trust made explicit and consistent on every surface ([[Phase 9 Trust and Verification]],
2026-07-11). **Why it exists:** trust is the product for a veteran-facing navigator — every
resource must show where its info came from, how fresh it is, and the app must never read as
the VA. Most signals shipped inside Phases 4–8; Phase 9 converged them and filled four gaps.

- **`SourceRow`** (`src/features/resources/SourceRow.tsx`) — **the** trust badge: shield/alert
  icon + tone-tinted label from `sourceStatus()` ("Official source · checked Jun 18, 2026" /
  "Community-submitted · may be outdated"). One component now used by `ResourceCard`,
  `ResourceDetail` (`size="body"`), and `ResourcePreview` (the map callout, previously the only
  badge-less surface); the two older inline copies were deleted. Text always carries the
  meaning — never color alone; `flexShrink` lets long labels wrap.
- **`trustWarning()`** (`resourceStatus.ts`) — one hedged amber sentence on the detail page's
  Trust section when info is stale (>90 days) or not `verified` ("…call ahead or check the
  official source."). Deliberately derived from the same predicate as `sourceStatus()` so the
  badge tone and the warning can never disagree. Rendered in `colors.warningText`.
- **`NavigatorDisclaimer`** (`src/components/NavigatorDisclaimer.tsx`) — the required copy
  ("Frontline helps you find resources. It is not the VA or a government agency…") owned by one
  quiet caption component. Rendered on **Results** (list footer under the official-sources widget
  + empty state) and the **detail page** bottom — i.e. on the resource surfaces themselves.
  Initially also on Home, removed 2026-07-11 on user feedback. Deliberately *not* floated over
  the fullscreen map (comment in `results.tsx`); two placements is the ceiling — don't add more
  (disclaimer fatigue).
- **`CrisisBanner`** (`src/features/resources/CrisisBanner.tsx`) — category-level crisis
  routing at the top of **Emergency results**: "If you're in immediate danger, call 911"
  (**text-only by design** — a mis-tap must never dial 911) + a tappable **"Call 988, then
  press 1"** (988 dialed plain; "press 1" lives in the copy because post-dial pauses are
  unreliable across dialers). Hoisted **above the results state machine** in `results.tsx` so
  it survives loading, error, empty, and list branches, and rendered above the map branch
  (map + floating toggle wrapped in `mapWrap` so the toggle stays anchored to the map).
- **`DangerCallBanner`** (in `EmergencyCallBanner.tsx`) — the shared danger-tinted shell
  (alert title, one context line, 52pt call button) wrapped by both `EmergencyCallBanner`
  (per-resource, detail page) and `CrisisBanner`, so the treatment can't drift. Titles use the
  new **`colors.dangerText`** (`#A93226`) token — danger as *text*, ≥4.5:1 on the tinted
  banner (the parallel of the existing `warning`/`warningText` split).
- **`callPhone`** (`resourceActions.ts`) — now catches the `tel:` rejection thrown where no
  dialer exists (simulator, iPad, web) and shows the number in an Alert instead of failing
  silently — on a crisis line, silence would be the worst UX.
- **How data flows:** everything derives from the `Resource` trust fields (`source_type`,
  `verification_status`, `last_checked`) via `resourceStatus.ts`; no new state or services.
- **What's mock:** the trust *data* is seeded (`seedResources.ts`) — the surfacing is real.
  988/911 are real numbers. **Extend later:** a real verification pipeline feeds the same
  fields ([[Phase 10 Backend and Data Ingestion]]); the AI-label layer is `AiContentBlock`
  (see the discovery section).

## Real backend — `supabase/`, `src/services/supabase` (Phase 10 slice 1, built 2026-07-12)

The mock era's exit ramp. **Why it exists:** real, curated resource data and real Claude guidance,
behind the *unchanged* `ResourceService`/`AiService` interfaces — the swap the seams were built for.

- **The switch** (`src/services/supabase/config.ts`): both service `index.ts` factories read
  `supabaseConfig` — null (no `EXPO_PUBLIC_SUPABASE_*` env) → mock + templated, the full offline
  demo mode; present → `SupabaseResourceService` + `ClaudeAiService`. Env reads are literal
  property accesses because Expo inlines `EXPO_PUBLIC_*` at bundle time (restart the dev server
  after editing `.env`).
- **Data path**: `supabase/migrations/` define `resources` (1:1 with the `Resource` type),
  `zip_centroids` (Census ZCTA — ZIP→origin without a geocoding API), and one nullable-arg
  `search_resources` RPC used for both search and browse. RLS makes the anon key strictly
  read-only. `SupabaseResourceService` calls it via the ~50-line fetch helper
  (`src/services/supabase/client.ts` — both auth headers, 8s timeout, error mapping); open-now and
  the explainable ordering stay client-side in the shared `sortResults.ts` (extracted from the
  mock, which remains the executable spec). Unknown origin → **null distances, honestly** — the
  fake-center fallback lives only in the mock. `listResources(category?, zip?, radiusMiles?)` takes a
  browse origin **and radius**; Discover and the Map tab pass the profile ZIP + `preferredRadiusMiles`
  (default 15) so browse stays near the user instead of returning every row nationwide.
- **AI path**: `supabase/functions/ai/` is the Claude proxy (the ONLY place the Anthropic key
  exists). It validates, sanitizes `firstName`, rate-limits (per-IP-hash, hourly, fail-open), then
  calls `claude-opus-4-8` with structured outputs so responses are shape-exact
  `NextStepPlan`/`CallScript`/`BenefitSummary`. `ClaudeAiService` (client) calls it with a 30s
  timeout and **falls back per-call to `TemplatedAiService`** on any failure — AI never
  hard-fails — and re-stamps `AI_NOT_ADVICE_DISCLAIMER` so the wording has one source of truth.
- **Failure honesty**: resource-path failures surface the existing error/retry UI — never silent
  mock data (simulated orgs must not be presented as real places). AI-path failures degrade to
  templated invisibly.
- **Curation**: `supabase/seed-data/resources.la.json` (the 12 LA rows, per-row human
  `last_checked`/`verification_status`) is uploaded verbatim by `scripts/seed.ts`
  (`node --experimental-strip-types`, service-role key from git-ignored `.env.seed`).
  No timestamp is ever auto-stamped; verifying a resource = a human edits the JSON + re-seeds.
- **What's mock:** nothing in this layer — but until the user deploys (runbook in
  [[2026-07-12 Phase 10 Supabase Backend and Claude Proxy]]) the app runs in offline mock mode.
  **Extend later:** accounts/sync, ingestion, `timezone` column (10.1); the RPC argument names are
  a public API contract.

## Backup sync — `src/services/sync`, `supabase/functions/sync` (Phase 10 slice 2, 2026-07-13)

Saved resources + profile, backed up server-side so they survive a reinstall — **no login**.

- **Identity** (`src/services/sync/deviceId.ts`): a random UUID in the platform keychain via
  `expo-secure-store` (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). It survives app deletion on **iOS**
  (→ reinstall-restore) but is wiped on **Android** uninstall (→ server backup only). It's a bearer
  capability secret, so nothing sensitive is stored under it and the backup tables are deny-all.
- **The seam** (`src/services/sync/backupSync.ts` + `backupClient.ts`): `SavedContext` and
  `ProfileContext` keep their exact public API. On hydrate they call `reconcileSaved` /
  `restoreProfile` (one cached pull/launch) *before* marking hydrated — a reinstall restores here.
  Writes call debounced, fire-and-forget `pushSaved`/`pushProfile`. **Every sync call is a no-op
  when the backend is unconfigured or the device id is unavailable**, so offline mode is unchanged.
- **Merge rules**: saved = union by id (earliest `savedAt` wins); profile = local-wins-else-restore
  (same-device only). Restored profile blobs go through the shared tolerant `parseProfile`
  (extracted from `profileStorage`). "Reset setup" also deletes the backup so restore can't undo it.
- **Isolation + safety** (`supabase/functions/sync`, `migrations/0005`): deny-all tables reached
  only via a service-role edge function (anon-key gated, rate-limited). `updated_at` monotonicity +
  the client's `isHydrated` gate together close the empty-reinstall clobber race.
- **What's mock:** nothing — but it's dormant until the user deploys + a native rebuild picks up
  the secure-store plugin. **Extend later:** a recovery code for Android reinstall + cross-device.

## Resource Ingestion Pipeline (WS-7: VA Facilities + USAJOBS)

### Date Added
2026-07-15 (VA); extended 2026-07-20 (nationwide + USAJOBS jobs); 2026-07-21 (HUD housing, HRSA +
SAMHSA healthcare, College Scorecard education — 6 sources, 8 of 11 categories covered)

### Purpose
Replace the 12 hand-curated LA rows with **real, verified, nationwide** resources. Pulls the
**VA Lighthouse Facilities API** (official VA health, benefits, Vet Centers → `healthcare` /
`benefits_help`) and the **USAJOBS API** (official federal job openings → `jobs`) and writes them
into the same `resources` table the app already reads — so the app gains real coverage with **zero
app-code change**. A nationwide VA load means **any ZIP returns real, distance-ranked results**
(e.g. ZIP 75034 → real Dallas-area VA clinics + federal jobs, not LA placeholders). This is the #1
"ready to send to real veterans" gap in the [[Backend to Production Master Plan]] (§WS-7).

### User Flow
No user-facing UI. It's operator tooling: an engineer runs `ingestion/run.ts` (dry-run first, then a
pilot load). Veterans simply see more real resources in search/discover/detail, each carrying an
official source badge and a `last_checked` date — the existing trust layer, now backed by live data.

### Important Files
| File | Purpose |
|---|---|
| `supabase/migrations/0008_provenance.sql` | Adds `external_id`/`source_provider`/`ingested_at` to `resources`, a partial dedup unique index, and the `resource_sources` lineage table (deny-all, service-role only). |
| `ingestion/types.ts` | The source-agnostic contract: `IngestionSource`, `NormalizedResource`, `SourceFactory`. |
| `ingestion/sources/vaFacilities.ts` | VA adapter → `healthcare`/`benefits_help`. `veteran_specific`. |
| `ingestion/sources/usaJobs.ts` | USAJOBS adapter → `jobs`. `veteran_benefit` (veterans' preference). |
| `ingestion/sources/vaGiBillSchools.ts` | VA GI Bill Comparison Tool API (keyless, `category=school`, per_page capped at 10 → ~1,380 pages) → `education`. Only GI-Bill-approved schools; ZIP-centroid geocode (`ingestion/geocode.ts`). `veteran_benefit`. |
| `ingestion/sources/curatedNational.ts` · `data/curated-national.json` | Hand-verified **veteran-specific** national referrals (VA homeless line, HUD-VASH/GPD/SSVF, VA-accredited legal, VTS/DAV, Caregiver, Vet Centers, Crisis Line) for categories with no per-place veteran dataset. Null coords → list, not map pin. |
| `ingestion/geocode.ts` | Offline ZIP → lat/long via the loaded Census ZCTA centroids (used by GI Bill schools). |
| `ingestion/refresh.sh` · `.github/workflows/refresh-data.yml` | Scheduled re-ingest — jobs weekly, places monthly (VA / GI Bill / referrals). |

**Veteran-relevance (`0011`/`0012`):** every resource has a NOT NULL `veteran_relevance`
(`veteran_specific` \| `veteran_benefit`). It's enforced at ingest, so the DB is **veteran-only by
construction** (no runtime filter). `<VeteranBadge>` shows it on each card. Sources dropped as general:
HRSA, HUD counseling, LSC, SAMHSA, College Scorecard (replaced by GI-Bill-approved schools). See
[[Decision Log]].

**Category balancing (`0010`):** `search_resources` takes a `per_category_limit` — a
`row_number() over (partition by category order by distance)` keeps only the nearest N per category, so
one dense category (healthcare ~38k) can't flood the map/browse. The client passes 50 for a focused
search and 30 for browse/map. No data is deleted; it's a query-time cap.
| `ingestion/upsert.ts` | Service-role, idempotent PostgREST upsert of `resources` + `resource_sources`. |
| `ingestion/run.ts` | CLI orchestrator: per-source env config → fetch → validate → (dry-run or upsert). |
| `ingestion/README.md` | How to get the free VA/USAJOBS keys and run each mode. |

### How The Code Works
`run.ts` loads env from `.env.seed`, picks a source from a registry (`va-facilities`, `usajobs`) —
each registry entry has a `resolveConfig()` that reads its own provider's keys — and calls
`source.fetch(query)`. USAJOBS pages `GET /search?LocationName=&Radius=` and maps each posting to a
`jobs` `Resource` (remote postings at `(0,0)` → null coords, so they rank last like crisis lines;
postings expire, so it's a location-scoped snapshot). The VA adapter pages through `GET /facilities`
(by `--national` type-sweep, `--state`, or `--lat/--long/--radius`), and for each facility: maps
`facilityType` → our `ResourceCategory`
(cemeteries and unknown types are **skipped**, not padded), checks coordinates are sane, builds the
address, and converts VA's per-day hours (`800AM-430PM`) into the app's **controlled** hours string
(`Mon-Fri 08:00-16:30`) that `src/lib/hours.ts` parses for "open now" — falling back to `null`
("unknown") rather than emit a misleading time. Because VA is an **official** API, rows are stamped
`source_type: 'official'`, `verification_status: 'verified'`, with `last_checked` = the fetch date.
`run.ts` then validates (defense-in-depth) and, unless `--dry-run`, `upsert.ts` writes resources
(merge on the deterministic id `va:<facility_id>`) and their raw payloads to `resource_sources`
(merge on provider+external_id) — so re-running is idempotent and never duplicates.

### Data Flow
VA Facilities API → adapter `normalize()` → `NormalizedResource[]` → validate → service-role upsert
→ `resources` (read by the unchanged `search_resources` RPC / `SupabaseResourceService`) + raw
lineage in `resource_sources`. Secrets (`VA_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) live only in the
git-ignored `.env.seed`; nothing ingestion-related ships in the app bundle.

### Important Types / Components / Functions
`NormalizedResource` (extends `Resource` with `external_id`/`source_provider`/`ingested_at`/`raw`);
`IngestionSource` + `SourceFactory` (the extension point); `createVaFacilitiesSource`;
`upsertResources`. Trust boundary mirrors `scripts/seed.ts` — service-role writes only.

### Temporary or Mock Parts
**Live as of 2026-07-20** — not mocked. Keys (VA sandbox, USAJOBS, service-role) are in `.env.seed`.
`resources` now holds **2,373 rows**: 12 curated + **2,261 VA facilities nationwide** (1,816
healthcare + 445 benefits) + **100 federal jobs near Dallas** — all `official`/`verified`, appearing
in search by distance from any ZIP. Caveats: VA runs on the **sandbox** (real-but-fixed dataset,
rate-limited → adapter throttles + 429-backoff); a VA **production** key (a demo, ~1–3 months) lifts
the limit + guarantees current nationwide coverage for launch. USAJOBS postings **expire**, so jobs
are a location-scoped snapshot needing periodic re-ingest. **Extend later:** more sources under
`ingestion/sources/` (HUD housing, USAJOBS more metros, 211/findhelp → `needs_review`), freshness
automation + purge of closed postings, cross-provider geo-dedup.

## Hybrid data cycle — veteran-first + labeled general, honest pins & freshness (2026-07-24)

### Why it exists
The final data-cycle audit found 7 of 11 categories nearly empty after the strict veteran-only
purge, refresh automation that had never run, school pins on ZIP centroids, and trust labels
implying human review. The user chose a **hybrid**: veteran resources always first, thin
categories backfilled with clearly-labeled general sources. See [[Decision Log]] (2026-07-24) and
[[2026-07-24 Data cycle final audit and hybrid rebuild]].

### Where the code lives
- **Relevance tier**: `supabase/migrations/0013` (adds `'general'`, still NOT NULL),
  `0014`+`0016` (search RPC: located rows fill the per-category cap veteran-first;
  null-distance referrals get their own cap of 3/category, curated hotlines first),
  `src/types/resource.ts` (`VeteranRelevance`), `src/features/resources/VeteranBadge.tsx`
  (muted "Open to everyone" badge), `src/services/resources/sortResults.ts` (relevance breaks
  distance ties; `isNationalReferral()`).
- **National help-lines strip**: `app/results.tsx` + `app/(tabs)/discover.tsx` partition
  null-coord veteran referrals into a labeled strip above local results (they no longer sort last
  on null distance). Discover's "all" browse keeps the category interleave.
- **Exact geocoding**: `ingestion/censusGeocode.ts` (Census batch geocoder + `geocode_cache`
  table, migration `0015`), `ingestion/sources/vaGiBillSchools.ts` (emits `geocode` address parts,
  null coords until matched). Unmatched = listed, never pinned. ZIP-centroid module deleted.
- **Sources**: `lscLegalAid.ts` (854, legal, general), `hudCounseling.ts` (1,315, housing,
  general), `ssvfProviders.ts` + `data/ssvf-providers.json` (235 VA SSVF grantees, housing,
  veteran_specific, quarterly manual), Vet Center cross-listing in `vaFacilities.ts`
  (→ community_support), `feedAmericaFood.ts` (food, pilot-gated aggregator, needs_review).
- **Freshness**: `.github/workflows/refresh-data.yml` (jobs weekly / places monthly, must live on
  `main` with 5 secrets set), `ingestion/refresh.sh`, `ingestion/freshnessGate.ts` (CI fails when
  any provider ages past cadence), failure auto-opens a GitHub issue.
- **Honest labels**: `resourceStatus.ts` ("From official VA/gov data · updated <date>"),
  `ResourceDetail.tsx` ("Data updated <date>"), `curatedNational.ts` (`last_checked` = the entry's
  `verified_on` human-review date).

### How data flows
Provider APIs / curated JSON → adapter `normalize()` (must set `veteran_relevance`) → optional
Census geocoding (cache-first) → validate → service-role upsert. The app reads the same
`search_resources` RPC; veteran-first lives in the RPC's window ordering + client tie-breaks, so
the visible sort stays nearest-first.

### What's mock vs production
Nothing is mocked. Feed America is **pilot-gated** (TX dry-run + spot-check; national needs the
CC BY-SA sign-off). Vet Center cross-listing re-ingest waits on `VA_API_KEY`. Cron waits on the
merge to `main` + secrets.

### How to extend
New source → `ingestion/README.md` "Adding a source": adapter + `veteran_relevance` + register +
add to `freshnessGate.ts` with a cadence. Providers with addresses but no coords set `geocode`
parts — never approximate.

## "Essentials" category + tighter general-data caps (2026-07-24)

### Why it exists
Food and Clothing were two separate home tiles, but Clothing has almost no local data (one national
referral) while Food is dense — an uneven pair. They were merged into one **Essentials** tile
("Food, clothing, and everyday basics"). Separately, the audit found HUD housing was the one
`general` dataset not capped in-app, so it could crowd a metro housing feed.

### Where the code lives
- **Merge is need-level only.** `src/types/need.ts` — `NeedCategory` is now 11 (`essentials` replaces
  `food`+`clothing`) with a single `NEED_CATEGORY_META` entry (`basket-outline`, ochre `#A56E24`).
  `src/services/resources/needMapping.ts` fans `essentials → ['food','clothing']` and maps both
  resource categories back to `essentials`. The **`ResourceCategory`** values `food`/`clothing` are
  unchanged in `src/types/resource.ts` and the DB — so resource cards keep their distinct Food/Clothing
  chips, and no migration was needed.
- `src/data/officialSources.ts` — one merged `essentials` link block (SNAP, Feeding America, Goodwill,
  Salvation Army, 211), de-duped. `src/features/discover/CategoryShells.tsx` — one Essentials shell.

### How data flows
A veteran taps **Essentials** → `needToResourceCategories` returns `['food','clothing']` →
`search_resources` RPC returns both → client sorts nearest-first with veteran rows first →
`capDenseGeneral` trims general rows to the nearest N. The general caps now live in
`supabaseResourceService.ts` as `DENSE_GENERAL_CAPS = { food: 20, housing: 20 }`; the cap only drops
rows with `veteran_relevance === 'general'`, so veteran SSVF/curated housing and the veteran food
referral are never dropped.

### What's mock vs production
Nothing is mocked. Clothing currently resolves to one national referral until a real clothing dataset
is ingested — which needs **no code change** (it already maps into `essentials`).

## "See in map" + frontend polish (2026-07-24)

### Why it exists
An "extreme, final" frontend audit. Two outcomes: (1) no overlapping text / spacing issues anywhere,
and (2) every opportunity can be found on the map — with an honest signal when it can't.

### Where the code lives
- **`src/features/resources/SeeInMapButton.tsx` (new)** — the one reusable control. `isOnMap(resource)`
  = `latitude && longitude`. Enabled → accent map icon + "See in map". Off-map → the map icon with a
  diagonal **strike** + "Not on map", `disabled`, screen-reader label "Not on the map". Two style
  variants — `card` (bordered rect, matches `ResourceCard`) and `pill` (matches `ActionRow`).
- **Focus wiring** — `ResourceMap.tsx` gained a `useEffect` that `animateToRegion`s to `selectedId`
  once `onMapReady` has fired (`mapReady` gate so the camera move isn't dropped). `fitToPins` skips
  fitting only when the selected pin actually exists in the current set.
- **Context-aware destinations** — `ResourceCard` takes an optional `onSeeInMap`. `app/results.tsx`
  passes one that flips to its in-place map view + sets `selectedId`. Elsewhere (Discover/Saved) and
  the detail page (`ActionRow`) navigate to the Map tab with `router.navigate({ pathname: '/map',
  params: { focus: id } })`; `app/(tabs)/map.tsx` reads `useLocalSearchParams().focus` → `selectedId`.

### How data flows
Tap "See in map" → (Results) `setSelectedId` + switch to map view, or (elsewhere) navigate to
`/map?focus=<id>` → the Map tab seeds `selectedId` → `ResourceMap`'s focus effect glides to the pin
and the `ResourcePreview` for `selected` renders. Off-map resources never call the handler.

### Design-system tokens (same pass)
`src/theme/spacing.ts` now exports `shadows` (sm/md/lg — replacing three hand-rolled recipes in
`Card`, `map`, `ResourceMap`) and an `xxs: 2` optical step (replacing scattered `gap:2`/`+2`/`padding:3`
magic numbers). `typography.ts` adds `displayLarge` (onboarding hero titles); `colors.ts` adds
`onboardingAccents` (an earth-tone quartet replacing off-palette blues/teals). Overlap fixes:
`numberOfLines`/`flexShrink`/`flexWrap`/`ellipsizeMode` across `ResourceCard`, `VeteranBadge`,
`StatusPill`, `ContactRow`, the map legend/footer, and the profile `InfoRow`.

### What's mock vs production
Nothing mock. All verified on an iOS simulator (cards, struck off-map state, map focus + preview).

## Tests + security hardening (2026-07-25)

### Why it exists
A final professionalism pass. The app had no automated tests and the edge functions had a couple of
security gaps a reviewer would flag.

### Where the code lives
- **Tests** — `vitest.config.ts` + co-located `*.test.ts` (35 tests) over the pure logic: `src/lib/geo`,
  `src/lib/hours`, `src/features/resources/resourceStatus`, `src/services/resources/sortResults` +
  `needMapping`. A shared `src/test/factories.ts` builds `Resource`/result fixtures. `npm test`
  (Vitest) also runs in CI.
- **Edge-function hardening** — `supabase/functions/ai` + `sync`: rate-limiting now hashes the
  **right-most** `x-forwarded-for` hop (the trusted one), caller payloads are size-capped (→ 413), and
  405s carry `Allow: POST`. The threat model (anon-key gate, Anthropic-console backstop, accepted
  risks) is written up in `SECURITY.md`. Both functions were redeployed and re-smoke-tested live.

### What's mock vs production
Nothing mock. Tests exercise real pure functions; the security changes are deployed to the live
Supabase project.

## Per-category visual identity (2026-07-25)

### Why it exists
Every category had a color that was used only on tiny icons, so cards/screens read as uniform cream.
This turns category color into a real identity so different opportunity types *look* different — while
staying calm and premium.

### Where the code lives
- **`src/theme/categoryVisual.ts`** — the derivation layer: `categoryVisual(hue)` → `{ tint, wash,
  border }`, `surfaceTint(hue, amount)` (alpha-composites a hue over the paper surface into a solid,
  AA-safe wash), and `medallionStyle()`. Consumers pass `meta.color` (from `NEED_/RESOURCE_CATEGORY_META`)
  so there are no duplicated hex values.
- **`src/components/CategoryMedallion.tsx`** — the shared glyph (category icon in its hue on a soft
  tint) used by cards, the detail hero, the map preview, and category rows.
- **`src/hooks/useReducedMotion.ts`** — one reduce-motion source for all animated surfaces.

### How it renders
`ResourceCard` leads with a `CategoryMedallion` and tints its whole surface with `surfaceTint(meta.color)`;
`ResourceDetail` opens with a full-bleed hero zone in the category hue + a large medallion + the
Fraunces name. `CategoryShells` chips keep their icon and wear their category hue when active. The
guardrail: category color is **identity only** — the single olive `accent` still owns every action
(buttons, links), and there are no colored side-rails (medallions + soft tints instead).

### What's mock vs production
Nothing mock. All tints derive from the two real category-metadata maps; verified on the iOS sim.

## What's coming (planned, not built)

Per [[Feature Priority Order]] and the roadmap:
- **[[Backend to Production Master Plan]]** — WS-7 later slices (more sources + freshness automation),
  and pre-launch polish (WS-2/3/4/5) + release (WS-8). WS-6 Google auth is **deliberately skipped**
  (anonymous device sync stays the identity model).
- Each feature gets its own walkthrough entry here as it's built.

## Related

[[Technical Architecture]] · [[Folder Structure]] · [[Frontline Command Center]] · [[Feature Priority Order]]
