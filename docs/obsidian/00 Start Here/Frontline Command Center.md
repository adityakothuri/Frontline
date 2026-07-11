---
tags: [command-center, start-here]
status: active
phase: "MVP loop built (Phases 0–8) — Granola UI overhaul done; on-device QA next"
updated: 2026-07-10
---

# Frontline Command Center

> **Find your next step.**
> This is the single entry point for the Frontline project. Start here every session.

---

## Current Status

🟢 **Frontline MVP in progress.** The reframe is complete, and the core loop
is coming together: a veteran opens the app, picks **what they need help with**, answers a few quick
questions, and sees **nearby simulated resources** with working Call/Directions. Built on the reused
design system + app shell, the Phase 2 **data/AI service seams**, and the Phase 3 **guided need
flow**. Legacy screens have been removed. Still to come: resource detail pages, AI call
scripts/summaries, and the map (Phases 4–7). The dev framework (agents, hooks, rules, skills, MCP,
Obsidian, workflow) is **preserved**.

## Current Phase

**Building the MVP.** Done: [[Phase 0 Setup]] · [[Phase 1 App Shell]] ·
[[Phase 2 Resource Data Model and Service]] (data/AI seams) · [[Phase 3 Guided Need Flow]] (first
visible screens) · **[[Phase 4 Resource List and Detail]]** (detail page + templated call script) ·
**[[Phase 5 Map and Discovery]]** (List⇄Map toggle in Results). Next: **[[Phase 6 AI Plans and Call
Scripts]]** (deepen the AI layer) — or a real device tap-through + `ui-reviewer`/`qa-tester` pass on
Phases 4–5 first.

## Current Active Task

**✅ Done — Profile view/edit split** ([[2026-07-11 Profile View Edit Split]]): the Profile tab is now
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

## Next Recommended Task

**On-device QA of the overhaul + profile rework.** Tap through the new Profile (view ⇄ edit toggle,
dirty-check discard confirm, save, reset, large accessibility text sizes), then the olive theme pass:
open a resource → **ActionRow** (Call records, Directions records, Save toggles once, Share opens
the OS sheet, pills wrap on a small screen) → **Call script** opens the bottom sheet (backdrop tap,
X, and Android back all animate closed; content scrolls on a short phone) → Results list⇄map ease →
onboarding progress bar forward **and back**. Confirm the trust labels read clearly in the new
text-grade amber. Then: **[[Phase 9 Trust and Verification]]** surfacing, or splash/app-icon artwork
(still pre-palette).

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
