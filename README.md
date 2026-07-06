# Watchdog

> **Neighborhood safety, verified by people.**

## Overview

Watchdog is a **React Native + Expo** neighborhood-safety app. Users connect (or, in the MVP,
**simulate**) home cameras and doorbells. AI watches for suspicious events but **never posts
anything publicly on its own** — it notifies the owner and creates an in-app review item. The
owner reviews the flagged clip, and only if they **approve** it does it become a public
neighborhood alert on a map, with an auto-delete expiration.

The MVP is a polished, believable **demo** of that loop with **simulated** camera and AI flows.
Real camera integrations and real AI/video detection are deliberately **future work** — the
code and docs label simulation honestly (`mock` / `demo` / `simulated`).

**Principles:** user control first · human verification (AI detects, people decide) · privacy
by default · calm (not alarmist) safety · local relevance · temporary-by-design alerts.

## Core MVP Flow

1. Enter the app (sign in or demo mode).
2. See a polished home dashboard.
3. View simulated cameras.
4. A simulated AI detection appears.
5. Review the detection.
6. Approve or reject it.
7. If approved, edit the description and expiration.
8. The approved alert appears on the neighborhood map.
9. Others open alert details.
10. The alert expires per its auto-delete setting.

## Feature Priorities

Foundation → app shell → camera simulation → AI detection simulation → **human review (core)**
→ public alert posting → map viewing → alert lifecycle/auto-delete → profile/settings →
*(post-MVP)* real backend → real AI/video → real cameras → advanced community.
Full list + reasoning: [docs/obsidian/01 Product/Feature Priority Order.md](docs/obsidian/01%20Product/Feature%20Priority%20Order.md).

## Tech Stack

- **React Native + Expo**, **TypeScript-first**
- **React Navigation** (structure chosen in Phase 1)
- Local state + typed **mock services** now; **Supabase/Firebase** later (post-MVP)
- **Context7 MCP** for up-to-date library docs
- Simulation-first: no real backend/model/camera SDKs in the MVP

## Project Structure

```text
Watchdog/
├── CLAUDE.md            # Claude Code behavior + product/workflow brief
├── SKILLS.md            # installed AI skills/tooling inventory
├── README.md
├── docs/
│   ├── obsidian/        # the project "brain" (product, design, technical, roadmap, logs)
│   └── github/          # git/GitHub workflow guides
├── .github/             # CI, issue/PR templates, dependabot
└── src/ (or app/)       # app code — created in Phase 1, feature-based (not yet present)
```

App code will follow a **feature-based** layout — see
[Folder Structure](docs/obsidian/03%20Technical/Folder%20Structure.md).

## Getting Started

> The app is not scaffolded yet (Phase 0). These steps apply once Phase 1 creates the Expo app.

**Prerequisites:** Node.js (this machine uses Node in `~/.local`, npm global prefix `~/.local`).

```bash
# after the app is scaffolded (Phase 1):
npm install
npm start        # start Expo
```

## Available Scripts

No `package.json` yet. When the app is scaffolded, these scripts are expected (and are what CI
and the quality hook look for):

| Script | Purpose |
|--------|---------|
| `start` | Launch the Expo dev server |
| `typecheck` | `tsc --noEmit` |
| `lint` | ESLint |
| `test` | Tests (added when meaningful) |
| `verify` | Convenience: typecheck + lint (+ test) — run before every PR |

## Development Workflow

Use the Claude Code workflow: `/start-task` → implement → quality checks → review →
`/finish-task`. **One task per branch.** Full detail:
[Production Workflow](docs/obsidian/03%20Technical/Production%20Workflow.md).

## Quality Checks

A checks-only post-edit hook (`.claude/hooks/quality-check.sh`) runs `typecheck`/`lint`/`test`
when they exist. Before opening a PR, run `verify`. See
[Quality Gates](docs/obsidian/03%20Technical/Quality%20Gates.md).

## Environment Variables

Copy `.env.example` → `.env.local` and fill values locally. **Only public `EXPO_PUBLIC_*` keys
belong in the app**; service-role/backend secrets never go in app source. `.env*` is
git-ignored; `.env.example` (placeholders only) is committed. See
[Environment Variables](docs/obsidian/03%20Technical/Environment%20Variables.md).

## Git Workflow

- Don't work directly on `main` for feature work — **one task per branch**
  (`feature/…`, `fix/…`, `docs/…`, `chore/…`, `refactor/…`).
- Run `verify` before a PR; PRs use [.github/pull_request_template.md](.github/pull_request_template.md).
- Never force-push, rewrite history, or commit secrets.
- Guides: [docs/github/](docs/github/) — Branching Strategy, PR Checklist, Release Process, GitHub Setup.

## Documentation

- **[CLAUDE.md](CLAUDE.md)** — controls Claude Code behavior; product + workflow brief.
- **[docs/obsidian/](docs/obsidian/)** — the project brain. Start at
  [Watchdog Command Center](docs/obsidian/00%20Start%20Here/Watchdog%20Command%20Center.md).
- **[docs/github/](docs/github/)** — git/GitHub workflow.
- **[SKILLS.md](SKILLS.md)** — installed AI skills/tooling.

## Current Status

🟡 **Phase 0 — Foundation.** Project brain + repo workflow are set up; **no app source code
yet, on purpose.** Next: Phase 1 — polished app shell (requires approval before creating app
source + dependencies).

## Notes

- **License:** proprietary — all rights reserved (see [LICENSE](LICENSE)). Not licensed for
  reuse; may be opened later.
- Simulation is labeled honestly; the MVP does **not** contain real camera or AI integrations.
- No real secrets are ever committed.
