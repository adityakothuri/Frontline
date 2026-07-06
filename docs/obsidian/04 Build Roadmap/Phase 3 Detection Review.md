---
tags: [roadmap, phase-3, mvp, core]
status: not-started
updated: 2026-07-05
---

# Phase 3 — AI Detection Simulation + Human Review

> Covers **Priority 3 (detection simulation)** and **Priority 4 (human review flow)** — the
> product's core differentiator. AI detects; the human decides.

## Purpose

Prove the core AI concept without a real model, and make it obvious the **user is in control**.

## Included

**Detection simulation**
- Simulated detection event with: type, confidence score, timestamp, camera source,
  thumbnail/video placeholder, severity, pending-review status.
- Detection categories: suspicious person, package theft, vehicle break-in, trespassing,
  vandalism, disturbance, unknown motion.
- Event detail screen.

**Human review flow**
- Pending detection **review queue**.
- Event review screen: video/thumbnail preview, AI-suggested description, confidence.
- **Approve** / **Reject** buttons.
- Edit description before posting; choose alert expiration; confirm before public post.

## Excluded

- Real detection model/pipeline (Priority 10 — [[Phase 8 Real AI and Camera Research]]).
- Public posting mechanics live in [[Phase 4 Alert Posting]] (this phase hands off an approved,
  edited detection ready to post).

## Checklist

- [ ] **Approve** new files: `features/detection/` (types, mock detections, queue + detail screens).
- [ ] `Detection` type (category, confidence, severity, source, status, media placeholder).
- [ ] Believable mock detections across categories/severities.
- [ ] Review queue screen (triage-friendly).
- [ ] Detection detail: preview + AI-suggested description + confidence + Approve/Reject.
- [ ] Edit-description + choose-expiration UI; confirm step.
- [ ] Empty/loading/error states.
- [ ] `ui-reviewer` (trust-focused) + `qa-tester` + `/finish-task`.

## Definition of done

- A simulated detection flows into the queue, can be reviewed, and **approved or rejected**.
- Approving leads to an editable, expiring, confirm-before-public hand-off.
- The UI makes user control obvious (Principles 1–2, [[Product Principles]]). Logged.

## Risks

- Auto-posting or hiding the human step (violates the core principle).
- Alarmist styling ([[UX Principles]]).
- Over-modeling detection before it's needed.

## Related

[[App Flow]] · [[Product Principles]] · [[Phase 4 Alert Posting]] · [[Anti-AI-Slop Design Rules]]
