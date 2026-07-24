---
tags: [technical, ai, source-of-truth]
status: active
updated: 2026-07-07
---

# AI Feature Design

Frontline's AI is **embedded into workflows**, never a chatbot. It appears at three moments in the
core loop and is always **simplified guidance, never legal / medical / financial /
government-certified advice** (see [[Trust Safety and Privacy]]).

## The `AiService` seam

All AI goes through one typed interface. Screens depend on the interface, not the implementation.

- **MVP:** a **templated** implementation — deterministic, offline, built from the structured need +
  resource fields. No network, no keys, fully demoable.
- **Later:** a **real** implementation calling the **Claude API via a proxy** (keys never in the
  client — see [[Environment Variables]]). Same interface, drop-in swap.

```ts
interface AiService {
  buildNextStepPlan(input: { need: Need; resource: Resource }): Promise<NextStepPlan>;
  buildCallScript(input: { need: Need; resource: Resource; tone: 'standard' | 'short' }): Promise<CallScript>;
  summarizeBenefit(input: { text: string; sourceUrl?: string; sourceType?: SourceType }): Promise<BenefitSummary>;
}
```

Each method returns a **typed, structured** object (not free text), so the UI renders consistent
sections and the templated vs real implementations are interchangeable.

## Feature 1 — Next-step plan

For a chosen resource + need, produce an **ordered, specific** plan.

- Fields: `steps[]` (each: action, detail, optional deadline/time), `whatToBring[]`, `backup`
  (a fallback resource/action).
- Style: concrete and sequenced — "Call this pantry before 4 PM", "Ask if they accept walk-ins",
  "Bring photo ID + proof of veteran status", "If they can't help today, try the backup below".

## Feature 2 — Call script (with a nervous-user variant)

Generate a short script the veteran can read on the phone; **varies by category** and resource.

- `tone: 'standard'` — e.g. Food: *"Hi, I'm a veteran looking for food assistance today. Are you
  open to walk-ins, and what documents should I bring?"*
- `tone: 'short'` — for nervous users, e.g. *"Hi, I'm a veteran and I need help with food. Can you
  tell me what I need to do?"*
- Category-specific templates for Food, Clothing, Housing, Healthcare, Benefits, Legal, Jobs, etc.

## Feature 3 — Benefit / document summarizer

Turn a confusing benefit page / resource description into plain English. Structured output:

- **What it is** · **Who it helps** · **Who may qualify** · **Documents that may be needed** ·
  **Deadlines / warnings** · **What to do next** · **Official / source link** · **Confidence /
  verification note** (flag when the source is not official).

## Guardrails (apply to every AI output)

- **Hedge eligibility:** "You *may* qualify if…", "This resource *appears* to help with…", "Confirm
  by calling or checking the official source." **Never** "you definitely qualify" unless the source
  data is extremely explicit (and then, attributed).
- **Label it:** every AI surface shows an "AI-generated — verify with the source" note.
- **No advice framing:** never legal, medical, financial, or government determinations.
- **No sensitive-data prompts:** the AI never asks for SSN, VA login, bank, or diagnosis.
- **Deterministic-friendly:** templated outputs must be believable and consistent (no `Lorem ipsum`).

## Real-API notes (for later)

- Use the latest capable Claude model via the proxy; keep prompts structured and return typed JSON.
- Retrieval/grounding over an official-benefits corpus is a **later** enhancement ([[Non-MVP Ideas]]).
- Rate-limit, cache, and degrade gracefully to the templated implementation on failure.

## Related

[[Resource Data Model]] · [[Trust Safety and Privacy]] · [[Technical Architecture]] · [[Environment Variables]] · [[Phase 6 AI Plans and Call Scripts]] · [[Phase 7 AI Summarization]]
