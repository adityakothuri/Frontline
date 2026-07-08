# Frontline Claude Instructions

Frontline is a frontend-heavy **React Native + Expo (TypeScript)** app that helps **veterans find
benefits, local resources, and practical next steps**. This file is the fast brief. The full
project brain lives in the Obsidian vault at
[docs/obsidian/](docs/obsidian/) — start at
[Frontline Command Center](docs/obsidian/00%20Start%20Here/Frontline%20Command%20Center.md).
Tooling inventory: [SKILLS.md](SKILLS.md).

> **Current phase: Reframed to Frontline (Phase 1 shell reused, feature build not started).**
> The Watchdog neighborhood-safety product was scrapped. The reusable design system + app shell
> (tokens, generic components, navigation) carry over; the first Frontline feature milestone is
> **Phase 2 — Resource Data Model & Mock Service**. New app files/dependencies still need approval.

## Product Summary

Frontline helps a veteran **find the help they need nearby and know exactly what to do next**. A
veteran opens the app, chooses **what they need help with** (food, housing, healthcare, VA benefits,
jobs, legal, transportation, and more), shares a location or ZIP, and gets **nearby relevant
resources**, **plain-English benefit explanations**, and **AI-generated next steps** — what to bring,
who to call, and what to say.

**AI is embedded into real workflows, not a chatbot.** The AI powers guided need flows, next-step
plans, call scripts, and benefit/document summaries — always presented as **simplified guidance,
never legal, medical, financial, or government-certified advice**. Frontline is a **resource
navigator, not the VA or a government agency**. Tagline spirit: *Find your next step.*

## Core MVP Flow

1. User opens Frontline and sees a clean home: **"What do you need help with?"**
2. User selects a **need category** (Food, Housing, Healthcare, Benefits, Jobs, Legal, …).
3. A short **guided flow** asks: what exactly, how urgent (today / this week / just info),
   in-person / online / either, which documents they have, and whether they want help calling,
   visiting, applying, or understanding.
4. User provides **location or ZIP code**.
5. App shows **top nearby resources** in **list and map** form.
6. User taps a resource to open its **detail page**.
7. Detail shows a **plain-English AI summary**, eligibility, documents needed, and **next steps**.
8. User taps **"Generate call script"** → a short, specific script for that resource (plus a
   shorter "nervous user" variant).
9. User can **save** the resource, get **directions**, or **call**.
10. Saved resources, benefits, scripts, and document checklists are available for later.

## Feature Priority Order

1. Foundation and project discipline
2. Polished app shell + design system (reused from the previous build)
3. Resource/benefit **data model** + typed mock service (and the `AiService` seam)
4. **"What do you need help with?"** guided need flow
5. Resource **list, cards, and detail pages**
6. **Map** + local resource discovery
7. **AI workflow layer** — next-step plans + call scripts (templated first, real API behind interface)
8. **AI summarization** — benefits/documents into plain English (with hedging + verification)
9. **Saved resources** + lightweight veteran **profile/preferences**
10. **Trust, safety & verification** surfacing
11. Real backend + verified data ingestion (post-MVP)

Details + reasoning: [Feature Priority Order](docs/obsidian/01%20Product/Feature%20Priority%20Order.md).

## MVP Features

A polished, trustworthy **demo** of the core loop (steps above), simulated where needed and
**labeled honestly** (`mock`/`demo`/`simulated`). MVP = polished app shell, the guided need flow,
local resource discovery (list + map with resource cards + detail pages), AI-generated next-step
plans and call scripts, AI benefit/document summarization, saved resources, a lightweight
optional-only veteran profile, and a visible trust/verification layer (source type, last-checked,
disclaimers). See [MVP Scope](docs/obsidian/01%20Product/MVP%20Definition.md).

## Not MVP Yet

Real backend persistence, live official-source data ingestion/scraping, real LLM calls shipped from
the client (needs a proxy), full VA **claims filing**, **login with VA credentials**, sensitive
**document upload**, and any automated legal/medical/financial advice. These are Priorities 11+ and
are **not built without explicit approval**. See
[Non-MVP Ideas](docs/obsidian/01%20Product/Non-MVP%20Ideas.md).

## Product Principles

1. **Veteran-first clarity** — plain language, low cognitive load, obvious next action.
2. **AI in workflows, not a chatbot** — AI powers plans, scripts, and summaries embedded in the flow.
3. **Trust by verification** — every resource shows source type, last-checked date, and status.
4. **Not advice** — AI output is simplified guidance, never legal/medical/financial/government-certified.
5. **Privacy by default** — collect the minimum; no SSN, VA login, bank info, or diagnosis.
6. **Accessibility always** — large tap targets, high contrast, screen-reader friendly.
7. **Local relevance** — location-based, useful to nearby people.
8. **Structured development** — plan, scope, implement, review, test, log.
9. **No AI slop** — intentional, typed, readable code; designed UI.
10. **No uncontrolled file creation** — plan + approval before new app files.

Full text: [Product Principles](docs/obsidian/01%20Product/Product%20Principles.md).

## Design Direction

Modern, premium, calm, serious, trustworthy — **not** childish, cluttered, alarmist, or
template-like. Dark navy/charcoal foundation, crisp white text, muted-gray cards; the accent blue
for primary actions; green for confirmed/verified, amber for "unverified / check the source," red
reserved for genuine emergencies. Strong consistent spacing; designed loading/empty/error states;
resource cards that surface the most important info fast. See
[UI Design System](docs/obsidian/02%20Design/UI%20Design%20System.md) and
[Anti-AI-Slop Design Rules](docs/obsidian/02%20Design/Anti-AI-Slop%20Design%20Rules.md).

## Technical Direction

React Native + Expo, TypeScript-first, feature-based folders. Start with local state + typed
**mock** services behind interfaces a real backend could later implement — including a typed
**`AiService`** (templated responses first, real Claude API behind the same interface later). **No**
backend, auth, real model calls, or global state library in the MVP. Real LLM calls must go through a
**proxy** (API keys never ship in the client). Verify library APIs with **Context7**. See
[Technical Architecture](docs/obsidian/03%20Technical/Technical%20Architecture.md),
[AI Feature Design](docs/obsidian/03%20Technical/AI%20Feature%20Design.md),
[Resource Data Model](docs/obsidian/03%20Technical/Resource%20Data%20Model.md), and
[Folder Structure](docs/obsidian/03%20Technical/Folder%20Structure.md).

## File Creation Policy

Claude must **not** create new app source files, screens, components, dependencies, backend
files, schemas, config systems, or architecture patterns without first stating the intended
**path, purpose, contents, kind, whether it's MVP-critical, and whether an existing file could
be updated instead** — then receiving approval.

**Allowed without asking:** updating existing docs; creating dated build logs; updating
`app_walkthrough`; updating decision logs; creating documentation files explicitly requested.

**For app code, new files require approval.** Canonical version:
[File Creation Policy](docs/obsidian/03%20Technical/File%20Creation%20Policy.md).

## Anti-AI-Slop Rules

The codebase must not look AI-generated.

**Avoid:** giant files; vague names (`Thing`, `Data`, `Card2`); duplicated components; random
abstractions; inconsistent styling; unused/dead code; fake complexity; unexplained mock data;
huge inline style blocks; unnecessary dependencies; unrelated changes; files created without
approval.

**Prefer:** small focused files; clear feature folders; typed data models; consistent design
tokens; readable components; simple architecture; realistic mock data; obvious data flow;
explainable code. Act like a careful senior engineer, not a chaotic code generator.

Canonical: [Anti-AI-Slop Code Rules](docs/obsidian/03%20Technical/Anti-AI-Slop%20Code%20Rules.md).

## Claude Development Rules (Frontline)

Because Frontline serves veterans, hold to these every session:

- The app is **Frontline**, not Watchdog. It helps veterans find benefits and local resources.
- The MVP is: **guided help flows, local resource discovery, AI summarization, generated call
  scripts, saved resources, and trust/verification.**
- **AI is embedded into workflows**, never a generic chatbot.
- Build **carefully, feature by feature**. Do not "build everything."
- Do **not** create files randomly without purpose; do not make massive unrelated changes.
- Always **preserve the established repo framework** (agents, hooks, rules, skills, MCP, Obsidian,
  workflow) unless explicitly told otherwise.
- Always **update documentation** when architecture or product decisions change.
- Always prioritize **accessibility, clarity, trust, and privacy**.
- **Avoid collecting sensitive data** unless absolutely necessary (never SSN, VA login, bank, diagnosis).
- **Never** present AI output as legal, medical, financial, or government-certified advice.

Canonical: [Claude Development Rules](docs/obsidian/03%20Technical/Claude%20Development%20Rules.md).

## Project Brain

The Obsidian vault is the source of truth. Read before acting:

- [Frontline Command Center](docs/obsidian/00%20Start%20Here/Frontline%20Command%20Center.md) — status, current/next task, links to everything.
- [Product](docs/obsidian/01%20Product/) · [Design](docs/obsidian/02%20Design/) · [Technical](docs/obsidian/03%20Technical/) · [Build Roadmap](docs/obsidian/04%20Build%20Roadmap/)
- [app_walkthrough](docs/obsidian/10%20App%20Walkthrough/app_walkthrough.md) — how the code actually works.
- Logs: [Build Logs](docs/obsidian/06%20Build%20Logs/) · [Decision Log](docs/obsidian/08%20Decisions/Decision%20Log.md) · [Bugs](docs/obsidian/07%20Bugs/) · [Feature Specs](docs/obsidian/12%20Feature%20Specs/)

## Required Task Flow

Use `/start-task` → implement → quality checks → review → `/finish-task`. Detailed:
[Production Workflow](docs/obsidian/03%20Technical/Production%20Workflow.md).

1. Clarify the task (`/start-task`).
2. Use `product-manager` if scope is unclear or feature-related.
3. Use `react-native-architect` before implementation.
4. Get approval for any new app files/dependencies (File Creation Policy).
5. Implement only the approved task.
6. Run quality checks.
7. Use `ui-reviewer` for screen/UI changes; `/slop-check` on the diff.
8. Use `qa-tester` before marking complete.
9. `/finish-task`: update logs and summarize changed files, checks, issues, next step.

**One task at a time. No "build everything."**

## Required Logging Behavior

After meaningful work, Claude must update:

- **Build log** — `docs/obsidian/06 Build Logs/` (dated).
- **`app_walkthrough`** — `docs/obsidian/10 App Walkthrough/app_walkthrough.md` (if meaningful).
- **Decision log** if a product/architecture decision was made — `docs/obsidian/08 Decisions/Decision Log.md`.
- **Bug log** if a bug was found/fixed — `docs/obsidian/07 Bugs/`.
- **Command Center** if current/next task or phase changed — `docs/obsidian/00 Start Here/Frontline Command Center.md`.

Logging is handled by the `/finish-task` and `/log-session` skills — **not** by hooks.

## App Walkthrough Requirement

After any **moderate or meaningful** feature/code addition, update
`docs/obsidian/10 App Walkthrough/app_walkthrough.md`. Explain: what was added, why it exists,
where the code lives, how the code works, how data flows, how the user interacts with it,
what's mock vs production, and how to extend it later.

**Moderate/meaningful** = new screen · feature folder · user flow · state logic · API/backend
logic · data schema · navigation structure · design-system implementation · reusable component
pattern · important refactor · a bug fix that changes how a flow works. **Not** for typos,
formatting-only, or trivial copy changes.

## Definition of Done

A task is not complete until:

- Approved scope is implemented.
- No unrelated features were added.
- No unauthorized files were created.
- Typecheck passes if available.
- Lint passes if available.
- Tests pass if available and meaningful.
- UI review (`ui-reviewer`) is done for visual work.
- QA review (`qa-tester`) is done.
- Build log is updated.
- `app_walkthrough` is updated if meaningful code was added.
- Decision log is updated if needed.
- Remaining risks are listed.

## Subagents

Use these project subagents:

- `product-manager`: before starting features or changing scope
- `react-native-architect`: before implementing React Native architecture or feature structure
- `ui-reviewer`: after UI/screen changes
- `qa-tester`: after implementation before calling a task done
- `release-manager`: for build/release/env/deployment work

Each agent already knows which project skills to use — the relevant skills are preloaded and/or
referenced in the agent's own config (`.claude/agents/*.md`), and the doc-consuming agents
(`react-native-architect`, `qa-tester`, `release-manager`) have Context7 access for up-to-date
library docs. You do **not** need to name skills manually; just invoke the agent.

Workflow skills: `/start-task` · `/finish-task` · `/log-session` · `/slop-check`. The project
`/slop-check` is the anti-AI-slop gate; the built-in `/code-review` remains available for deep
multi-agent correctness reviews.

## GitHub Workflow

- Do not work directly on `main` for feature work.
- Prefer one task per branch.
- Branch names should be clear, such as `feature/guided-need-flow` or `fix/resource-card-empty-state`.
- Do not commit or push unless explicitly asked.
- Do not force push.
- Do not create or change remote repo settings without approval.
- Before PRs, run the project verification command (`npm run verify`).
- PRs should use `.github/pull_request_template.md`.
- Meaningful changes must update Obsidian build logs.
- Meaningful feature/code additions must update `docs/obsidian/10 App Walkthrough/app_walkthrough.md`.

GitHub workflow docs live in [docs/github/](docs/github/) (Branching Strategy, PR Checklist,
Release Process, GitHub Setup).

## Quality Checks

A `PostToolUse` hook (`.claude/hooks/quality-check.sh`, configured in `.claude/settings.json`)
runs after every `Edit`/`Write`/`MultiEdit`. It runs the project's `typecheck`, `lint`, and
`test` scripts **only if they exist**, never modifies files, and fails loudly if a real check
fails. It is a **checks-only** hook — logging is done by `/finish-task` and `/log-session`, not
by the hook. See
[.claude/hooks/README.md](.claude/hooks/README.md) and
[Quality Gates](docs/obsidian/03%20Technical/Quality%20Gates.md).
