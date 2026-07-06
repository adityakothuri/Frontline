# Watchdog Claude Instructions

Watchdog is a frontend-heavy **React Native + Expo (TypeScript)** neighborhood-safety app.
This file is the fast brief. The full project brain lives in the Obsidian vault at
[docs/obsidian/](docs/obsidian/) — start at
[Watchdog Command Center](docs/obsidian/00%20Start%20Here/Watchdog%20Command%20Center.md).
Tooling inventory: [SKILLS.md](SKILLS.md).

> **Current phase: Phase 0 — Foundation.** No app source code exists yet, on purpose. The app
> shell is next and requires approval before any source files or dependencies are created.

## Product Summary

Watchdog is a neighborhood safety app where users connect or simulate cameras, review
AI-detected suspicious events, approve or reject detections, and post approved alerts to a
neighborhood map with auto-delete settings.

**AI assists users; it does not replace user judgment.** User approval is required before
anything becomes public. Tagline spirit: *Neighborhood safety, verified by people.*

## Core MVP Flow

1. User opens the app.
2. User signs in or enters demo mode.
3. User sees a polished home dashboard.
4. User views connected/simulated cameras.
5. A simulated AI detection appears.
6. User reviews the detection.
7. User approves or rejects it.
8. If approved, the user can edit description and expiration.
9. Approved alert appears on the neighborhood map.
10. Other users can open alert details.
11. Alert expires based on auto-delete settings.

## Feature Priority Order

1. Foundation and project discipline
2. Polished app shell
3. Camera feed simulation
4. AI detection simulation
5. Human review flow
6. Public alert posting
7. Map-based alert viewing
8. Alert lifecycle and auto-delete
9. Profile and settings
10. Real backend integration
11. Real AI/video processing
12. Real camera integrations
13. Advanced community features

Details + reasoning: [Feature Priority Order](docs/obsidian/01%20Product/Feature%20Priority%20Order.md).

## MVP Features

A polished, believable **demo** of the core loop (steps above). Simulated where needed, and
**labeled honestly** (`mock`/`demo`/`simulated`). MVP = polished app shell, simulated cameras,
simulated detection, human review (approve/reject/edit/expiration), public alert posting,
map viewing, alert expiration/auto-delete, light profile/settings.
See [MVP Definition](docs/obsidian/01%20Product/MVP%20Definition.md).

## Not MVP Yet

Real Ring/live streaming, real AI model, real backend persistence, police/emergency
integration, advanced moderation, payments, comments, social feed. These are Priorities 9–13
and are **not built without explicit approval**.
See [Non-MVP Ideas](docs/obsidian/01%20Product/Non-MVP%20Ideas.md).

## Product Principles

1. **User control first** — nothing private becomes public automatically.
2. **Human verification** — AI detects; users decide.
3. **Privacy by default** — raw footage stays private unless intentionally posted.
4. **Calm safety** — serious and trustworthy, not alarmist.
5. **Local relevance** — location-based, useful to nearby people.
6. **Temporary by design** — alerts auto-delete/expire.
7. **Beautiful MVP** — polished and demo-ready.
8. **Structured development** — plan, scope, implement, review, test, log.
9. **No AI slop** — intentional, typed, readable code; designed UI.
10. **No uncontrolled file creation** — plan + approval before new app files.

Full text: [Product Principles](docs/obsidian/01%20Product/Product%20Principles.md).

## Design Direction

Modern, premium, calm, serious, trustworthy — **not** childish, cluttered, fearmongering,
generic, or template-like. Dark navy/charcoal foundation, crisp white text, muted-gray cards;
red/orange **only** for serious alert emphasis; green for safe/confirm; subtle map styling;
strong consistent spacing; designed loading/empty/error states.
See [UI Design System](docs/obsidian/02%20Design/UI%20Design%20System.md) and
[Anti-AI-Slop Design Rules](docs/obsidian/02%20Design/Anti-AI-Slop%20Design%20Rules.md).

## Technical Direction

React Native + Expo, TypeScript-first, feature-based folders. Start with local state + typed
**mock** services behind interfaces a real backend could later implement. **No** backend,
auth, real model, or global state library in the MVP. Verify library APIs with **Context7**.
See [Technical Architecture](docs/obsidian/03%20Technical/Technical%20Architecture.md) and
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

## Project Brain

The Obsidian vault is the source of truth. Read before acting:

- [Watchdog Command Center](docs/obsidian/00%20Start%20Here/Watchdog%20Command%20Center.md) — status, current/next task, links to everything.
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
- **Command Center** if current/next task or phase changed — `docs/obsidian/00 Start Here/Watchdog Command Center.md`.

Logging is handled by the `/finish-task` and `/log-session` skills — **not** by hooks.

## App Walkthrough Requirement

After any **moderate or meaningful** feature/code addition, update
`docs/obsidian/10 App Walkthrough/app_walkthrough.md`. Explain: what was added, why it exists,
where the code lives, how the code works, how data flows, how the user interacts with it,
what's mock vs production, and how to extend it later.

**Moderate/meaningful** = new screen · feature folder · user flow · state logic · API/backend
logic · DB schema · navigation structure · design-system implementation · reusable component
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
- Branch names should be clear, such as `feature/phase-1-navigation` or `fix/map-alert-empty-state`.
- Do not commit or push unless explicitly asked.
- Do not force push.
- Do not create or change remote repo settings without approval.
- Before PRs, run the project verification command (`npm run verify`).
- PRs should use `.github/pull_request_template.md`.
- Meaningful changes must update Obsidian build logs.
- Meaningful feature/code additions must update `docs/obsidian/10 App Walkthrough/app_walkthrough.md`.

GitHub workflow docs live in [docs/github/](docs/github/) (Branching Strategy, PR Checklist,
Release Process, GitHub Setup). Git is initialized locally on `main` (no commits/remote yet);
`gh` v2.96+ is installed at `~/.local/bin/gh` but **not** authenticated — creating the remote
needs approval.

## Quality Checks

A `PostToolUse` hook (`.claude/hooks/quality-check.sh`, configured in `.claude/settings.json`)
runs after every `Edit`/`Write`/`MultiEdit`. It runs the project's `typecheck`, `lint`, and
`test` scripts **only if they exist**, never modifies files, and fails loudly if a real check
fails. It is a **checks-only** hook — logging is done by `/finish-task` and `/log-session`, not
by the hook. Until `package.json` exists it is a no-op. See
[.claude/hooks/README.md](.claude/hooks/README.md) and
[Quality Gates](docs/obsidian/03%20Technical/Quality%20Gates.md).
