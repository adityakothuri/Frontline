---
tags: [product, trust, safety, privacy, source-of-truth]
status: active
updated: 2026-07-07
---

# Trust, Safety & Privacy

Frontline serves veterans, often in vulnerable moments. Trust is the product. These rules are
**non-negotiable** and must be consistent across [[Product Overview]], [[AI Feature Design]], and the
UI ([[UI Design System]]).

## 1. Frontline is a navigator, not the government

- The app must **never imply it is the VA or a government agency** unless it is clearly displaying
  official VA information (and attributing it).
- A persistent, plain disclaimer: *"Frontline helps you find resources. It is not the VA or a
  government agency. Always confirm details with the official source."*

## 2. Verification is visible on every resource

Every resource surfaces trust signals (see the model in [[Resource Data Model]]):

- **`source_type`** — one of: `official` · `directory` · `nonprofit` · `community` · `unverified`.
- **`verification_status`** — e.g. `verified` · `needs_review` · `unverified`.
- **`last_checked`** — the date the info was last confirmed.
- **`source_url`** — link to the original/official source when available.
- A **warning treatment** when info may be outdated (`last_checked` is old) or `unverified`.

UI: a source badge + last-checked line on cards and detail pages; amber for unverified/outdated,
green for verified. Never rely on color alone (accessibility) — include text.

## 3. AI output is guidance, never advice

- AI content (summaries, next-step plans, call scripts) is **simplified guidance**, explicitly **not
  legal, medical, financial, or government-certified advice**.
- Eligibility language is **hedged**: "You *may* qualify if…", "This resource *appears* to help
  with…", "Confirm by calling or checking the official source." Never "you definitely qualify"
  unless the source data is extremely explicit (and then, attributed).
- Every AI surface carries a short "AI-generated — double-check with the source" label.

## 4. Data minimization / privacy by default

- **Never collect:** SSN, VA login credentials, bank/financial info, or specific medical diagnosis.
- **Profile is optional** and used only to personalize recommendations — never to gatekeep access.
  Optional fields: ZIP/city, role (veteran/active/family/caregiver/other), general needs, disability
  **rating range** (if volunteered), housing situation, employment/student status, preferred radius,
  preferred contact method, and **which documents they already have** (veteran ID, VA card, DD-214,
  photo ID, proof of address, proof of income) — as a checklist, not uploads.
- MVP stores profile/saved items **on-device** only. No account, no server, no tracking.
- Location: prefer **ZIP entry**; if using device location, ask clearly and allow ZIP as an
  alternative.

## 5. Safety & emergencies

- The **Emergency** category and any acute-risk content must point to appropriate hotlines (e.g.
  **988 Suicide & Crisis Lifeline, press 1** for veterans) and 911 for immediate danger — Frontline
  does not attempt to handle crises itself.

## 6. Honest simulation

- MVP data is **mock/simulated** and labeled as such; templated AI is labeled `templated`. Never
  dress a simulated integration up as a live/official one. See [[Anti-AI-Slop Code Rules]].

## Related

[[Product Principles]] · [[Resource Data Model]] · [[AI Feature Design]] · [[MVP Acceptance Criteria]] · [[Environment Variables]]
