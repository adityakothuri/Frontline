# Contributing to Frontline

Frontline is built with discipline: scoped tasks, clean typed code, and honest logging. These
rules keep the codebase serious and maintainable. The canonical, deeper versions live in the
Obsidian vault ([docs/obsidian/](docs/obsidian/)); this file is the git-facing summary.

## Development Principles

- **Veteran-first clarity & privacy** — plain language, an obvious next action, and the minimum data
  collected (an optional, on-device profile with an anonymous backup; never SSN, VA login, bank,
  or diagnosis).
- **AI in workflows, not an open-ended chatbot** — AI powers plans, scripts, summaries, and the
  Ask Frontline navigator, where every reply ends in an in-app action. Its output is simplified
  guidance, never legal/medical/financial/government-certified advice.
- **Trust by verification** — every resource shows source type, last-checked date, and status.
- **No AI slop** — intentional, typed, readable code and designed UI.
- **Structured development** — plan → scope → implement → review → test → log.
- Full text: [Product Principles](docs/obsidian/01%20Product/Product%20Principles.md).

## Before You Start

1. Read [CLAUDE.md](CLAUDE.md) and the
   [Command Center](docs/obsidian/00%20Start%20Here/Frontline%20Command%20Center.md).
2. Confirm the task is in scope for the current phase / MVP
   ([Feature Priority Order](docs/obsidian/01%20Product/Feature%20Priority%20Order.md)).
3. Use `/start-task` to produce a plan **before** coding.
4. Create or confirm a **task branch** (one task per branch).

## Branch Naming

One task per branch. Examples:

```text
feature/guided-need-flow
feature/see-in-map
fix/resource-card-empty-state
chore/github-ci
docs/update-readme
refactor/resource-types
```

## Commit Style

Small, focused, present-tense. Examples:

```text
feat: add the guided need flow
fix: handle empty resource results state
docs: update app walkthrough
chore: add GitHub CI workflow
refactor: simplify resource sort logic
```

(No enforced commitlint tooling unless explicitly added later.)

## Pull Request Rules

- **One task per PR.** No unrelated changes. No giant PRs.
- New source files/dependencies must have been **planned and approved** first
  ([File Creation Policy](docs/obsidian/03%20Technical/File%20Creation%20Policy.md)).
- No non-MVP features without approval.
- **No secrets** — ever.
- Fill in [.github/pull_request_template.md](.github/pull_request_template.md) honestly.

## Quality Gates

Run before every PR:

```bash
npm run verify        # typecheck + lint + format:check + test
npm run format        # fix Prettier issues (app source; Markdown is excluded)
```

Also run the app and exercise the flow for anything with runtime behavior. CI
([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the same checks. See
[Quality Gates](docs/obsidian/03%20Technical/Quality%20Gates.md).

## File Creation Policy

Do **not** create new app source files, folders, components, dependencies, config systems,
backend files, or schemas without first stating path + purpose + contents + kind +
MVP-critical? + "could an existing file be updated?" — then getting approval. Canonical:
[File Creation Policy](docs/obsidian/03%20Technical/File%20Creation%20Policy.md).

## Anti-AI-Slop Rules

No giant files, vague names (`Thing`, `Data`, `Card2`), duplicate components, fake complexity,
dead code, unexplained mock data, or unrelated changes. Prefer small focused files, typed
models, consistent tokens, real (not invented) data, obvious data flow. Canonical:
[Anti-AI-Slop Code Rules](docs/obsidian/03%20Technical/Anti-AI-Slop%20Code%20Rules.md).

## Obsidian Logging Requirements

After **meaningful** work, update the project brain (via `/finish-task` or `/log-session`):

- **Build log** — `docs/obsidian/06 Build Logs/` (dated).
- **app_walkthrough** — `docs/obsidian/10 App Walkthrough/app_walkthrough.md` (for meaningful
  feature/code additions).
- **Decision log** — `docs/obsidian/08 Decisions/Decision Log.md` (architecture/product decisions).
- **Bug log** — `docs/obsidian/07 Bugs/` (bugs found/fixed).

## Definition of Done

- Approved scope implemented; no unrelated features; no unauthorized files.
- Typecheck / lint / tests pass (where available and meaningful).
- UI review done for visual work; QA review done.
- Build log updated; app_walkthrough updated if meaningful; decision log updated if needed.
- Remaining risks listed. Full: [Quality Gates](docs/obsidian/03%20Technical/Quality%20Gates.md).
