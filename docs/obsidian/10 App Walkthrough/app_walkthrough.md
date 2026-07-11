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
  this is what feeds Home's `ReviewPrompt`. The 👍/👎 rating and the **simulated** community rating
  (`src/lib/ratings.ts`, deterministic from id, always labeled "simulated (demo)") are shown as
  **separate facts**, never blended.
- **What's mock:** resource data + AI are still simulated/templated (Phase 2). ZIP isn't geocoded yet
  (falls back to the seed city center).

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
  the source" label + disclaimer + a **skeleton** loading slot (no data of its own; **title
  optional**). Wraps the summary, plan, and call script.
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
- **Map tab** (`app/(tabs)/map.tsx`) — all located resources as pins, no category scope. Since
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

## What's coming (planned, not built)

Per [[Feature Priority Order]] and the roadmap:
- **Map** discovery — a List⇄Map toggle in Results ([[Phase 5 Map and Discovery]]).
- Deeper **AI plans + call scripts** ([[Phase 6 AI Plans and Call Scripts]]) and **saved resources**
  ([[Phase 8 Saved and Profile]], where the deferred Save action lands).
- Each feature gets its own walkthrough entry here as it's built.

## Related

[[Technical Architecture]] · [[Folder Structure]] · [[Frontline Command Center]] · [[Feature Priority Order]]
