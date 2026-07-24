---
tags: [build-log, phase-4, resources, detail, ai]
date: 2026-07-08
status: done
---

# 2026-07-08 — Phase 4: resource detail page + card → detail

## What was built

Made the results list open into a **complete resource detail page**. Cards are now tappable; the
detail page composes the plain-English AI summary, eligibility, a "what to bring" checklist, contact,
hours, trust/verification, an AI next-step plan, and a generated call script — with Call · Directions
pinned at the bottom. All of it runs on the seams built in Phases 2–3 (`resourceService.getById`,
the three templated `aiService` methods, and the `resourceActions`/`resourceStatus` helpers). See
[[Phase 4 Resource List and Detail]] and [[App Flow|Core User Flows]].

### New route
- `app/resource/[id].tsx` — thin detail route: reads `id` + `category`, `resourceService.getById`,
  designed loading / not-found states, renders `<ResourceDetail>`. Registered as
  `<Stack.Screen name="resource/[id]">` in `app/_layout.tsx` (shares a factored `themedHeader` const
  with `results`).

### New feature components — `src/features/resources/`
- `ResourceDetail.tsx` — the composition hub. Eagerly loads the benefit summary + next-step plan on
  mount; renders every section; owns the sticky Call/Directions footer.
- `AiContentBlock.tsx` — presentational chrome that sets AI output visibly apart with an
  **"AI-generated — verify with the source"** label + disclaimer + loading slot. Reused by the
  summary and the plan (and inside the call-script card). Holds no data.
- `DocumentChecklist.tsx` — "What should I bring?" checkable rows from `documents_needed`
  (local-only state; a packing aid, not persisted).
- `CallScriptCard.tsx` — lazy "Generate call script" via `aiService.buildCallScript`, with a
  **standard ⇄ "keep it simple" (nervous-user)** toggle, tips, and disclaimer.
- `StatusPill.tsx` — extracted from `ResourceCard` (open-now/status dot + label), now reused by the
  card and the detail header.

### Changed
- `ResourceCard.tsx` — the whole card is now `Pressable` → typed
  `router.push('/resource/[id]', { id, category })`; added a "View details ›" affordance; imports
  the extracted `StatusPill`; dropped its local `TONE_COLOR`.
- `resourceStatus.ts` — added exported **`STATUS_TONE_COLOR`** (tone→color), the single source now
  read by the card, the pill, and the detail trust row (killed a duplicated map).
- `types/need.ts` — added **`defaultNeedForCategory(category, zip)`**; both `results.tsx` and the
  detail page build their `Need` through it (no duplicated literal).
- `results.tsx` — uses `defaultNeedForCategory`; passes `needCategory` to each card.

## Notable decision — threading the need category
`getById` returns a `Resource`, whose `category` is the 11-value `ResourceCategory` — **not** the
12-value `NeedCategory` the AI calls expect. Rather than a lossy reverse map, the veteran's original
`NeedCategory` is carried card → detail as a route param (`?category=…`), so AI context stays true.
Falls back to `general_benefits` on a bare deep link. See [[Decision Log]].

## Scope honored
- **Save deferred to Phase 8** — no Save button (avoids a dead stub). Actions are Call · Directions ·
  View details · Generate call script.
- AI is **templated** (Phases 6–7 deepen it); every AI surface carries the not-advice disclaimer.
- `react-native-architect` approved the file structure before implementation.

## Checks
- `npm run verify` (typecheck + lint) — **passes clean**.
- Metro (dev client, iOS sim) — **bundled all 1168 modules** including every new file; no unresolved
  imports. The `/resource/[id]` deep link resolves (route registered).
- ⚠️ **Interactive tap-through not automatable in this environment** (no `idb`/`cliclick`; macOS
  blocks synthetic input), so the rendered detail layout still needs a human tap-through (or
  `ui-reviewer`) — see risks.

## Risks / follow-ups
- Detail page layout not yet eyeballed on-device (see above) — walk Home → category → card → detail;
  confirm AI blocks, checklist toggles, trust row (stale **DAV vans** entry shows amber), Call/
  Directions intents, and the call-script standard⇄simple toggle.
- Nested-pressable touch: card is pressable and contains Call/Directions `Pressable`s — verify inner
  actions don't also trigger navigation on-device.
- `ui-reviewer` + `qa-tester` still to run once the account session limit resets.

## Related
[[Phase 4 Resource List and Detail]] · [[app_walkthrough]] · [[Decision Log]] · [[Screens List]] ·
[[AI Feature Design]] · [[Frontline Command Center]]
