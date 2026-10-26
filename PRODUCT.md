# Product

## Register

product

## Users

U.S. military veterans (and family members or caseworkers helping them) who need practical help
now — food, housing, healthcare, VA benefits, jobs, legal aid, transportation. Often stressed,
sometimes in crisis, frequently on older phones, in variable light, with low patience for
navigating bureaucracy. The job to be done: "find the help I need nearby and know exactly what to
do next."

## Product Purpose

Frontline is a resource navigator: pick a need, answer a few guided questions, share a ZIP, and get
nearby resources with their source and last-checked date, plain-English explanations, next-step
plans, and call scripts. AI is embedded in workflows (plans, scripts, summaries). The one
conversational surface, the **Ask Frontline** navigator, is bounded so that every reply ends in a
concrete in-app action. AI output is never presented as legal, medical, financial, or
government-certified advice. Success = a veteran leaves a session knowing
their next concrete step. Tagline spirit: *Find your next step.*

## Brand Personality

Calm, capable, trustworthy. A steady caseworker, not a startup. The visual system is **"Field
Manual"**: it should read like a well-made printed field guide. Manila paper, ink hairline rules,
and numbered sections replace floating cards. Barlow Condensed is the display face, Public Sans
(the US Web Design System face) carries the prose, and Overpass Mono caps set data and labels. One
olive-drab action color owns every action. Semantic color carries meaning: green means verified,
amber means check the source, and red is for genuine emergencies only. Motion is quiet and
purposeful. The tokens live in [src/theme/](src/theme/).

## Anti-references

- Government-portal density (VA.gov form walls, dense legalese).
- Alarmist or charity-poster tones; nothing that makes the veteran feel pitied.
- Generic template SaaS: identical card grids, gradient text, glassmorphism, hero-metric tiles.
- Chatbot-first apps. AI here supports a task and is never the destination. Even Ask Frontline
  exists to route a veteran to an action.
- The rounded-card, pill-button, gradient-sparkle "AI app" template.

## Design Principles

1. **Obvious next action** — every screen answers "what do I do now?" in one glance.
2. **Trust is visible** — source type, last-checked date, and verification status are UI, not fine print.
3. **Low cognitive load** — short flows, plain language, one decision at a time.
4. **Calm under stress** — quiet motion, generous tap targets, no urgency theater outside real emergencies.
5. **Designed, not templated** — intentional hierarchy and spacing; no filler sections.

## Accessibility & Inclusion

WCAG AA contrast for all text (small text ≥4.5:1); large tap targets (≥44pt); full screen-reader
labeling (roles, states, loading announcements); reduced-motion-friendly (animations are subtle,
short, and never gate content); works one-handed on small phones.
