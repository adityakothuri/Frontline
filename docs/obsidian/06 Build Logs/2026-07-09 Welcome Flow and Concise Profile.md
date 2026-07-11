---
tags: [build-log, onboarding, profile, design]
date: 2026-07-09
status: done
---

# 2026-07-09 — Gorgeous account-creation flow + concise Profile

Turned first-run into a proper **account-creation pipeline** (the first thing users see) and made the
Profile concise. Craft/visual + a small routing change; data model + store unchanged. Pure-JS.

## One cohesive pipeline
- **`app/index.tsx`** → now a **pure gate** (no UI): once hydrated, `router.replace(onboardingComplete
  ? '/home' : '/onboarding')`. A fresh launch lands **directly** on the welcome (confirmed on a clean
  reinstall — the hero renders immediately).
- **`app/onboarding.tsx`** → owns the whole flow as a step machine:
  **Welcome → Name → ZIP → Role → Documents → Radius → Create account.** Name/ZIP gate Continue; the
  three preferences Skip. Finish saves the draft once → `/home`.

## New bookends
- **`OnboardingWelcome.tsx`** — the hero: brand mark (compass on a lime tile) inside a soft lime
  **halo**, **"Welcome to Frontline"** in big Fraunces, a warm subtitle, a **"Let's get started"** CTA,
  and quiet "No sign-in · nothing sensitive · about 2 minutes". **Staggered entrance** from one
  Animated driver (mark scales/fades, then title/subtitle/CTA rise), reduce-motion aware.
- **`OnboardingComplete.tsx`** — the finale: a **success check** (lime pop-in), "You're ready, {name}.",
  a **recap** of what they entered as small chips (ZIP · role · N documents · radius), and a big
  **"Create account"** button that saves on-device (with a "saved on this device · no sign-in" line).

## Prompt steps
`OnboardingStep` progress now counts the **5 questions** (welcome + create-account bookend it); each
step keeps its icon hero, big Fraunces prompt, spring-in, back chevron, and pinned Continue / Skip.
Role + documents use the spacious **row** options; radius uses pills.

## Concise Profile — `app/(tabs)/profile.tsx`
Switched role + documents from tall full-width **rows** to compact **pill** chips (they wrap instead
of stacking), dropped section headers to `subtitle` size, and tightened spacing. The screen is now a
fraction of its former height: avatar header → four compact chip/field sections → Save + a subtle
Reset. (Spacious rows stay in the focused wizard; compact chips fit the dense settings screen.)

## Checks
- `npm run verify` (typecheck + lint) — **passes clean**. Pure-JS, no native rebuild.
- Clean reinstall → app opens **straight to the Welcome hero** (brand tile + halo confirmed rendering).
- ⚠️ Full walk-through (welcome CTA → prompts → create → home; and the Profile tab) not fully
  screenshot-able here (dev-menu overlay + no sim tap tooling) — needs a human pass.

## Risks / follow-ups
- On-device: dismiss the dev menu → the full welcome + "Let's get started" → the prompt steps → the
  **Create account** finale → Home greets by name; relaunch goes straight to Home. Check the Profile
  tab reads concise.
- `ui-reviewer` (welcome craft, contrast, motion; profile density) + `qa-tester` once the session resets.

## Related
[[2026-07-09 Setup and Profile UI Redesign]] · [[2026-07-08 Extended Profile Multi-Step Setup]] ·
[[UI Design System]] · [[Frontline Command Center]]
