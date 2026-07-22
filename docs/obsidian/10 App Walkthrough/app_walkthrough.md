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
  colors) for located resources; fits the viewport to the pins on `onMapReady` (`SEED_CENTER` first
  paint); `tracksViewChanges={false}` after first paint for perf. Tap a pin → `ResourcePreview`.
  Resources with **null coords** (phone/online-only, e.g. the Veterans Crisis Line) get no pin —
  shown as a count note, or a full "Phone & online only" empty state if a category has only those.
- **Location (`src/services/location/`)** — `showsUserLocation` (blue dot, gated on granted) + a
  **recenter** button. `useUserLocation(zip)` resolves **device GPS with a ZIP-geocode fallback**
  (`userLocation.ts` wraps `expo-location`); permission is requested **only on the recenter tap**,
  never persisted. `mapRef.animateToRegion` pans to the user (or geocoded ZIP). **Data stays LA:**
  pins/`fitToPins`/distances are unchanged — location is overlay + camera only. Needs a native build
  (Info.plist permission via the `expo-location` config plugin). See [[Decision Log]].
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
| `ingestion/sources/vaFacilities.ts` | VA adapter — `apikey` fetch, `--national`/geo/state scopes, VA-hours → controlled format. |
| `ingestion/sources/usaJobs.ts` | USAJOBS adapter — `Authorization-Key`+`User-Agent` fetch, location-scoped federal jobs. |
| `ingestion/sources/hudCounseling.ts` | HUD housing-counseling adapter (keyless geo locator) → `housing`. Service-code jargon → plain English. |
| `ingestion/sources/hrsaHealthCenters.ts` | HRSA adapter (keyless **national CSV**, RFC-4180 parse, Active sites only) → `healthcare`. 18.9k sites. |
| `ingestion/sources/samhsaTreatment.ts` | SAMHSA FindTreatment adapter (keyless national export) → `healthcare`. Filters out HRSA-typed dup rows; keeps SA/MH/OTP. |
| `ingestion/sources/collegeScorecard.ts` | College Scorecard adapter (`DATA_GOV_API_KEY`, 0-indexed paging) → `education`. ~6.2k schools. |
| `ingestion/sources/lscLegalAid.ts` | LSC legal-aid adapter (keyless **ArcGIS** feature server, paged on `exceededTransferLimit`) → `legal`. 854 offices. |
| `ingestion/refresh.sh` · `.github/workflows/refresh-data.yml` | Scheduled re-ingest — jobs weekly, places monthly; purges expired USAJOBS rows. |
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

## What's coming (planned, not built)

Per [[Feature Priority Order]] and the roadmap:
- **[[Backend to Production Master Plan]]** — WS-7 later slices (more sources + freshness automation),
  and pre-launch polish (WS-2/3/4/5) + release (WS-8). WS-6 Google auth is **deliberately skipped**
  (anonymous device sync stays the identity model).
- Each feature gets its own walkthrough entry here as it's built.

## Related

[[Technical Architecture]] · [[Folder Structure]] · [[Frontline Command Center]] · [[Feature Priority Order]]
