---
tags: [design, flow]
status: active
updated: 2026-07-07
---

# Core User Flows

The core MVP journey, end to end. Mirrors the [[MVP Definition|MVP Scope]] "must prove" steps:
**need → discover → understand → act**.

## Primary loop — "I need help"

```
Open Frontline
      │
      ▼
Home: "What do you need help with?"  (12 need categories)
      │  select a category
      ▼
Guided flow:  what · urgency (today/this week/info)
              in-person / online / either
              documents on hand · help type (call/visit/apply/understand)
      │
      ▼
Location or ZIP
      │
      ▼
Results ── list ⇄ map ──► Resource cards (name · category · distance · open? · next action)
      │
      │  tap a resource
      ▼
Resource detail
   ├─ plain-English AI summary  (what it is · who it helps · who may qualify)
   ├─ eligibility · documents needed ("What should I bring?" checklist)
   ├─ hours · phone · website · address
   ├─ source type · verification status · last-checked  (trust)
   ├─ AI next-step plan (ordered: who to call, what to bring, backup)
   └─ [ Generate call script ] ──► short script + nervous-user variant
      │
      ▼
Act:  Call  ·  Directions  ·  Save
```

## Secondary flows

- **Understand a benefit:** Home → General VA / Education → benefit summary → **AI summarizer**
  (hedged: "you *may* qualify… confirm with the source") → **Save** benefit + checklist.
- **Saved:** revisit saved resources, benefits, call scripts, and document checklists.
- **Profile:** optional-only fields (ZIP, role, needs, radius, documents on hand) that personalize
  results — never required, never gatekeeping.
- **Emergency:** the Emergency category surfaces crisis resources (988 press 1, 911) directly.

## Key transitions & guarantees

- **AI appears inside the workflow**, at the moment it's useful (summary, plan, script) — never as a
  standalone chatbot. See [[AI Feature Design]].
- **Trust is always visible**: source + last-checked + verification on every resource; unverified /
  outdated is flagged. See [[Trust Safety and Privacy]].
- **Privacy by default**: ZIP works without device location; no login; optional-only profile.
- Every step has designed **loading / empty / error** coverage (see [[UI Design System]]).

## Related

[[Screens List]] · [[Map and Search Design]] · [[Product Overview]] · [[User Stories]] · [[Phase 3 Guided Need Flow]]
