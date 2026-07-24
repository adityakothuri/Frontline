---
tags: [build-log, phase-6, ai, mvp]
date: 2026-07-08
status: done
---

# 2026-07-08 — Phase 6: deepen the templated AI (plans + call scripts)

Phase 6's structure already shipped in Phase 4 (templated `buildNextStepPlan` + `buildCallScript`,
the detail-page plan block, the call script behind a button). This pass makes the **offline** AI
genuinely useful and adds the three chosen extras. Stays fully **templated — no real Claude, no keys,
no proxy**. Guardrails intact (hedged language, "AI-generated — verify" labels). Architect-reviewed,
`expo-clipboard` API Context7-verified.

## Deeper next-step plan — `templatedAiService.ts`
- Timing is now specific: open now → **"call before [closing time] today"** (new
  `closingTimeToday(hours)` helper in `@/lib/hours`, reusing the existing parser); closed → "try
  during their hours: …"; and a new **online-only** step ("start online at [website]") when there's
  no phone/address.

## Personalized call script — `AiService.ts` + `templatedAiService.ts` + `CallScriptCard.tsx`
- Added optional **`firstName?`** to the `buildCallScript` input (interface + impl; **not** on
  `buildNextStepPlan` or `Need`). The standard script now opens **"Hi, my name is [firstName]."**,
  falling back to the `______` blank when no name. `ResourceDetail` passes `profile?.firstName`.

## Emergency fast-path — `EmergencyCallBanner.tsx` (new) + `ResourceDetail.tsx`
- For `category === 'emergency'`, a prominent **contact-only** urgent card renders at the **top** of
  the detail (red `danger` treatment, alert icon, big **Call [phone]** button → e.g. 988). No triage,
  no advice — just a fast way to reach the resource, so it carries no AI disclaimer.
- The call script **defaults to the shorter, calmer tone** for emergency (`initialTone` prop).

## Copy call script — `CallScriptCard.tsx` (expo-clipboard)
- A secondary **Copy** control on the script → `Clipboard.setStringAsync(script.script)` with a
  time-boxed "Copied" state (ref-guarded timeout, cleared on unmount/collapse). Not promoted to a
  PrimaryButton (won't compete with the sticky Call action).
- **`AiContentBlock` title made optional** — removes the duplicate "Call script" heading (the outer
  `Section` titles it now).

## Dependency / native
- `expo-clipboard@~8.0.8` (already in `package.json`; it post-dated the prior binary) → **native
  rebuild** (`prebuild` + `run:ios`): **Build Succeeded**, `ExpoClipboard 8.0.8` in `Podfile.lock`,
  app launches healthy.

## Checks
- `npm run verify` (typecheck + lint) — **passes clean**.
- iOS Simulator — native build succeeded, clipboard pod linked, app launches with no crash; Home
  renders (category colors visible).
- ⚠️ The detail-page AI surfaces (deepened plan, name in the script, Copy, emergency banner) not
  screenshot-able here (no sim tap tooling) — need a human pass.

## Risks / follow-ups
- On-device: open a normal resource → detail → next-step plan reads specific (closing time /
  walk-in / docs); **Get a call script** greets by name + **Copy** works; open the **Veterans Crisis
  Line** (emergency) → the urgent Call card is up top and the script defaults to short.
- Confirm every AI surface still shows the "AI-generated — verify" label and hedged eligibility.
- `ui-reviewer` (emergency banner + copy control) + `qa-tester` (name present/absent, emergency vs
  normal, copy) once the account session limit resets.

## Related
[[Phase 6 AI Plans and Call Scripts]] · [[AI Feature Design]] · [[app_walkthrough]] ·
[[Decision Log]] · [[Frontline Command Center]] · [[Phase 7 AI Summarization]]
