# Frontline

> **Find your next step.** Frontline helps veterans find benefits, local resources, and a clear
> plan for what to do next.

## Overview

Frontline is a **React Native + Expo** app that helps **veterans** navigate the fragmented world of
benefits and local help. A veteran opens the app, chooses **what they need help with** (food,
housing, healthcare, VA benefits, jobs, legal, transportation, and more), shares a **location or
ZIP**, and gets **nearby relevant resources**, **plain-English benefit explanations**, and
**AI-generated next steps** — what to bring, who to call, and what to say.

The AI is **embedded into real workflows** (guided need flows, next-step plans, call scripts,
benefit summaries), **not a chatbot**. Frontline is a **resource navigator, not the VA or a
government agency**, and its AI output is **simplified guidance, never legal, medical, financial, or
government-certified advice**.

The MVP is a polished, trustworthy **demo** of that loop with **simulated** data and **templated**
AI behind a typed `AiService` seam. Real backend persistence, verified data ingestion, and real LLM
calls are **later phases** — the code and docs label simulation honestly (`mock` / `demo` /
`simulated` / `templated`).

**Principles:** veteran-first clarity · AI in workflows (not a chatbot) · trust by verification ·
not advice · privacy by default (no SSN/VA-login/bank/diagnosis) · accessibility always.

## Core MVP Flow

1. Open the app → **"What do you need help with?"**
2. Pick a **need category**.
3. Answer a short **guided flow** (what · urgency · in-person/online · documents on hand · help type).
4. Provide **location or ZIP**.
5. See **nearby resources** as a **list and map**.
6. Tap a resource for its **detail**.
7. Read a **plain-English summary**, eligibility, documents, and **next steps**.
8. Tap **"Generate call script"** for a short, specific script (+ a nervous-user variant).
9. **Save**, **call**, or get **directions**.

## Feature Priorities

Foundation → app shell/design system → **resource data model + `AiService` seam** → **guided need
flow** → **resource list/cards/detail** → **map discovery** → **AI plans + call scripts** → **AI
summarization** → **saved + profile** → **trust/verification** → *(post-MVP)* backend + verified
data ingestion.
Full list + reasoning: [docs/obsidian/01 Product/Feature Priority Order.md](docs/obsidian/01%20Product/Feature%20Priority%20Order.md).

## Tech Stack

- **React Native + Expo**, **TypeScript-first**
- **expo-router** (file-based routing)
- **react-native-maps** for local resource discovery on iOS/Android (web shows a placeholder)
- Local state + typed **mock services** behind interfaces (`ResourceService`, `AiService`); real
  backend + **AI proxy** later (post-MVP — keys never ship in the client)
- **Context7 MCP** for up-to-date library docs
- Simulation-first: no real backend/model calls in the MVP

## Project Structure

```text
Frontline/
├── CLAUDE.md            # Claude Code behavior + product/workflow brief
├── SKILLS.md            # installed AI skills/tooling inventory
├── README.md
├── docs/
│   ├── obsidian/        # the project "brain" (product, design, technical, roadmap, logs)
│   └── github/          # git/GitHub workflow guides
├── .github/             # CI, issue/PR templates, dependabot
├── app/                 # expo-router routes (shell reused; feature screens being built)
└── src/                 # components, theme tokens, services (resources, ai)
```

App code follows a **feature-based** layout — see
[Folder Structure](docs/obsidian/03%20Technical/Folder%20Structure.md).

## Getting Started

**Prerequisites:** Node.js ≥ 20.19.4 (this machine uses Node in `~/.local`), and a way to preview —
an iOS Simulator (development build), Android emulator, or a web browser.

```bash
npm install
npm start        # start the Expo dev server, then press i / a / w
```

📖 **Full run instructions:** [docs/RUNNING.md](docs/RUNNING.md) — prerequisites, each platform,
what you'll see, and troubleshooting.

## Available Scripts

| Script | Purpose |
|--------|---------|
| `start` | Launch the Expo dev server |
| `ios` / `android` / `web` | Start directly on a platform |
| `typecheck` | `tsc --noEmit` |
| `lint` | ESLint |
| `format` | Prettier (app source only) |
| `test` | Placeholder (real tests added when meaningful) |
| `verify` | typecheck + lint — run before every PR (also what CI runs) |

## Development Workflow

Use the Claude Code workflow: `/start-task` → implement → quality checks → review →
`/finish-task`. **One task per branch.** Full detail:
[Production Workflow](docs/obsidian/03%20Technical/Production%20Workflow.md).

## Quality Checks

A checks-only post-edit hook (`.claude/hooks/quality-check.sh`) runs `typecheck`/`lint`/`test`
when they exist. Before opening a PR, run `verify`. See
[Quality Gates](docs/obsidian/03%20Technical/Quality%20Gates.md).

## Environment Variables

The MVP needs **no secrets** (data is simulated, AI is templated). When real integrations arrive,
**only public `EXPO_PUBLIC_*` keys** belong in the app; the **AI/Anthropic key never ships in the
client** — real LLM calls go through a server-side proxy. `.env*` is git-ignored. See
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
  [Frontline Command Center](docs/obsidian/00%20Start%20Here/Frontline%20Command%20Center.md).
- **[docs/github/](docs/github/)** — git/GitHub workflow.
- **[SKILLS.md](SKILLS.md)** — installed AI skills/tooling.

## Current Status

🟡 **Reframed to Frontline.** The previous neighborhood-safety product was scrapped;
this repo is now Frontline (a veteran benefits/resource navigator). The reusable **design system +
app shell** carry over; documentation, `CLAUDE.md`, and app config are reframed. **Feature screens
are built next**, starting with the resource data model + service seams
([Phase 2](docs/obsidian/04%20Build%20Roadmap/Phase%202%20Resource%20Data%20Model%20and%20Service.md)).
Until then the running app still shows the legacy shell/screens. See
[docs/RUNNING.md](docs/RUNNING.md).

## Notes

- **License:** proprietary — all rights reserved (see [LICENSE](LICENSE)). Not licensed for reuse.
- Simulation is labeled honestly; the MVP does **not** contain real backend or live LLM calls.
- **Not the VA:** Frontline is a navigator; AI output is guidance, not legal/medical/financial/
  government-certified advice.
- No real secrets are ever committed.
