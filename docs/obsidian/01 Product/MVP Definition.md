---
tags: [product, mvp, source-of-truth]
status: active
updated: 2026-07-07
---

# MVP Scope

The MVP is a **polished, trustworthy demo of the core loop**: a veteran picks **what they need
help with** → answers a short **guided flow** → sees **nearby resources** on a **list + map** →
opens a resource for a **plain-English AI summary, eligibility, documents, and next steps** →
generates a **call script** → **saves / calls / gets directions**. Data is **simulated** in the MVP
and labeled honestly. AI is **embedded in the workflow**, behind a typed `AiService` (templated
first — see [[AI Feature Design]]).

## The MVP must prove

1. User opens the app to a clean **"What do you need help with?"** home.
2. User selects a **need category** (Food, Clothing, Housing, Healthcare, Disability, Education,
   Jobs, Legal, Transportation, Family/Caregiver, Emergency, General VA benefits).
3. User completes a short **guided flow** (what · urgency · in-person/online/either · documents on
   hand · help type) producing a structured "need."
4. User provides a **location or ZIP code**.
5. User sees **top nearby resources** in **list and map** form, as **resource cards**.
6. User opens a **resource detail** with a **plain-English AI summary**, eligibility, documents
   needed, hours, contact, source/verification, and **AI next steps**.
7. User taps **"Generate call script"** → a short, specific script + a shorter nervous-user variant.
8. User can **save** a resource (and benefits / scripts / document checklists) for later.
9. A lightweight **veteran profile** personalizes recommendations (optional-only fields).
10. Every resource visibly shows **source type + last-checked + verification status** and a
    "Frontline is a navigator, not the VA" disclaimer.

Testable form: [[MVP Acceptance Criteria]].

## The MVP must NOT require

- A real backend / persistence beyond on-device storage (Priority 11: [[Phase 10 Backend and Data Ingestion]])
- **Real LLM calls shipped from the client** (needs a proxy; templated responses in-app for the MVP)
- Live official-source data ingestion / scraping (seeded verified-looking mock data for now)
- VA **claims filing**, **login with VA credentials**, or sensitive **document upload**
- Automated legal / medical / financial advice
- Real device permissions beyond basic location / ZIP entry

(See [[Non-MVP Ideas]] and priorities 11+ in [[Feature Priority Order]].)

## Honesty rule

Use clear internal naming — `mock`, `demo`, `simulated`, `templated` — wherever a system is not
real. **Never make a fake integration look like a real production integration** in code or docs.
Never present AI output as legal/medical/financial/government-certified. See
[[Anti-AI-Slop Code Rules]] and [[Trust Safety and Privacy]].

## MVP definition of done

- The 10 "must prove" steps work end-to-end as a demo ([[MVP Acceptance Criteria]]).
- The UI looks **designed**, not templated ([[UI Design System]]); accessible (large targets, contrast).
- Simulated systems and templated AI are clearly labeled.
- Trust/verification and disclaimers are visible on every resource.
- Each shipped feature has a build log + [[app_walkthrough]] entry.
- No unauthorized files or dependencies were introduced ([[File Creation Policy]]).

## Related

[[Product Overview]] · [[Feature Priority Order]] · [[MVP Acceptance Criteria]] ·
[[Phase 2 Resource Data Model and Service]] · [[Quality Gates]]
