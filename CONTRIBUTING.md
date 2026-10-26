# Contributing to Frontline

Frontline is built with scoped tasks, clean typed code, and an honest record of what changed.

## Development Principles

- **Veteran-first clarity & privacy** — plain language, an obvious next action, and the minimum data
  collected (an optional, on-device profile with an anonymous backup; never SSN, VA login, bank,
  or diagnosis).
- **AI in workflows, not an open-ended chatbot** — AI powers plans, scripts, summaries, and the
  Ask Frontline navigator, where every reply ends in an in-app action. Its output is simplified
  guidance, never legal/medical/financial/government-certified advice.
- **Trust by verification** — every resource shows source type, last-checked date, and status.
- **Intentional code** — typed, readable, and small enough to explain.
- **Structured development** — plan → scope → implement → review → test.

## Before You Start

1. Confirm the task fits the product scope in [PRODUCT.md](PRODUCT.md).
2. Write a short plan before coding.
3. Create or confirm a **task branch** (one task per branch).

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
docs: update the README
chore: add GitHub CI workflow
refactor: simplify resource sort logic
```

## Pull Request Rules

- **One task per PR.** No unrelated changes. No giant PRs.
- New source files and dependencies should be justified in the PR description: could an existing
  file have been updated instead?
- **No secrets** — ever.
- Fill in [.github/pull_request_template.md](.github/pull_request_template.md) honestly.

## Quality Gates

Run before every PR:

```bash
npm run verify        # typecheck + lint + format:check + test
npm run format        # fix Prettier issues (app source; Markdown is excluded)
```

Also run the app and exercise the flow for anything with runtime behavior. CI
([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the same checks.

## Code Standards

No giant files, vague names (`Thing`, `Data`, `Card2`), duplicate components, fake complexity,
dead code, unexplained mock data, or unrelated changes. Prefer small focused files, typed
models, consistent design tokens, real (not invented) data, and obvious data flow.

## Definition of Done

- Scope implemented; no unrelated features.
- `npm run verify` passes.
- Visual changes checked on a device or simulator, with screenshots in the PR.
- Remaining risks listed in the PR.
