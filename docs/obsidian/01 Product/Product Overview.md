---
tags: [product, overview, source-of-truth]
status: active
updated: 2026-07-07
---

# Product Overview

> **Frontline — Find your next step.** Frontline helps veterans find benefits, local resources, and
> a clear plan for what to do next.

## The problem

Veterans are eligible for a wide range of benefits and local help — food assistance, housing and
rent support, healthcare, disability and education benefits, job and legal help, transportation, and
more — but the system is **fragmented, jargon-heavy, and hard to navigate**. Information is spread
across VA pages, state and county offices, 2-1-1 directories, and local nonprofits. Benefit pages are
written in bureaucratic language. It's often unclear **who to call, what to bring, or what to say.**

## The idea

A veteran opens Frontline to a calm home screen asking **"What do you need help with?"**, picks a
**need category**, answers a few short guided questions, and shares a **location or ZIP code**. The
app returns **nearby, relevant resources** as a **list and a map**. Opening a resource shows a
**plain-English summary**, who it helps, likely eligibility, documents to bring, and **AI-generated
next steps**. One tap generates a **call script** for that resource. The veteran can **save**,
**call**, or get **directions**.

## Target user

A veteran (or a family member / caregiver acting on their behalf) who needs help now or wants to
understand what they're entitled to — often stressed, short on time, and tired of bureaucratic
runaround. See [[User Personas]] and [[User Stories]].

## Core workflow

1. Open the app → **"What do you need help with?"**
2. Pick a **need category** and answer a short **guided flow** (what, how urgent, in-person/online,
   documents on hand, and what kind of help they want).
3. Provide **location or ZIP**.
4. See **top nearby resources** as a **list and map**.
5. Open a resource → **plain-English AI summary**, eligibility, documents, and **next steps**.
6. Tap **"Generate call script"** → a short, specific script (plus a shorter "nervous user" variant).
7. **Save**, **call**, or get **directions**.

## Why it's different

- **AI embedded in workflows, not a chatbot.** AI produces next-step plans, call scripts, and
  plain-English summaries at the moment they're useful — never a blank "ask me anything" box. See
  [[AI Feature Design]].
- **Trust is visible.** Every resource shows its **source type**, **last-checked date**, and
  **verification status**, with a link to the original source. See [[Trust Safety and Privacy]].
- **Honest and respectful.** Frontline is **not the VA** and says so. AI output is **simplified
  guidance**, never legal/medical/financial/government-certified advice ("you *may* qualify…
  confirm with the official source").
- **Privacy by default.** Collects the minimum; **never** SSN, VA login, bank details, or diagnosis.

## What it should feel like

Calm, premium, trustworthy — closer to a well-designed public-service tool than a startup app or a
government form. Plain language, big tap targets, obvious next action. See [[UI Design System]] and
[[Anti-AI-Slop Design Rules]].

## What it is not (yet)

Not a claims-filing tool, not a VA-login portal, not a document-upload vault, not legal/medical
advice, and not a live-backend product in the MVP. See [[MVP Definition|MVP Scope]] and
[[Non-MVP Ideas]].

## Related

[[MVP Definition|MVP Scope]] · [[Feature Priority Order]] · [[Product Principles]] ·
[[Trust Safety and Privacy]] · [[App Flow|Core User Flows]] · [[Frontline Command Center]]
