# Watchdog — AI Skills & Tooling

This project is a **frontend-heavy React Native app** (in progress). This file is the
organized inventory of the AI-assistant skills and tooling installed in the repo.

> Skills are curated for a React Native build. Web-DOM design skills (Tailwind/shadcn/GSAP),
> opinionated web style skills, and marketing-asset generators were deliberately removed —
> see [Removed](#removed-pruned-for-react-native).

## Directory layout

| Path | What it is |
|------|------------|
| `.claude/skills/` | **Active skills Claude Code loads** (source of truth). Real dirs + symlinks into `.agents/skills/`. |
| `.claude/rules/context7.md` | Rule telling the agent to use Context7 for library docs. |
| `.agents/skills/` | Universal skill store. Backs the Claude Code symlinks and serves Cursor / Codex / other harnesses. |
| `.codex/` | Codex hook manifest (from Impeccable). Only relevant if you use Codex. |
| `.mcp.json` | MCP servers (Context7). **Contains an API key — git-ignored.** |
| `skills-lock.json` | Lockfile for skills installed via the `skills` CLI. |

## Active skills by category

### React Native — engineering (Callstack)
| Skill | Purpose |
|-------|---------|
| `react-native-best-practices` | Performance: FPS, TTI, bundle size, memory leaks, re-renders, animations, Hermes, FlashList, native modules, jank. |
| `react-navigation` | Navigation UIs: stacks/tabs/drawers, headers, bottom sheets, safe areas & insets. |
| `upgrading-react-native` | RN version upgrades via rn-diff-purge diffs; deps, iOS/Android native config, CocoaPods/Gradle. |
| `create-react-native-library` | Scaffold RN libraries and local native modules/views. |
| `react-native-brownfield-migration` | Incrementally adopt RN/Expo inside existing native apps. |
| `react-native-tv-best-practices` | TV apps: focus/D-pad, 10-foot UI, playback/DRM. *(only if targeting TV)* |
| `github` | PRs, stacked PRs, code review, branching via `gh`. |
| `github-actions` | RN CI: iOS simulator / Android emulator cloud builds + artifacts. |
| `validate-skills` | Meta — validate skill authoring against the agentskills.io spec (`/validate-skills`). |

### UI / UX design (React-Native-relevant)
| Skill | Purpose |
|-------|---------|
| `ui-ux-pro-max` | Primary UI/UX reference — RN-aware palettes, type pairings, components, styles. |
| `impeccable` | Design *process*: shape → critique → audit → polish, anti-slop rules. *(its `/impeccable live` browser mode is web-only)* |
| `imagegen-frontend-mobile` | Generate premium mobile screen/flow design references (image-only). |

### Docs / context
| Skill | Purpose |
|-------|---------|
| `context7-mcp` | Pull **up-to-date library docs** (React Native, Expo, React Navigation, etc.). MCP server in `.mcp.json` + helper skill. Loads on Claude Code restart. |

### Notes / Obsidian (kepano)
| Skill | Purpose |
|-------|---------|
| `defuddle` | Extract clean markdown from web pages (token-efficient reader; use instead of raw fetch). |
| `obsidian-markdown` | Obsidian-flavored markdown: wikilinks, callouts, embeds, frontmatter. |
| `obsidian-cli` | Read/create/search an Obsidian vault; plugin/theme dev & debugging. |
| `obsidian-bases` | `.base` files — database-like views, filters, formulas. |
| `json-canvas` | `.canvas` files — mind maps, flowcharts, visual canvases. |

### Utility
| Skill | Purpose |
|-------|---------|
| `full-output-enforcement` | Bans placeholder code; enforces complete, unabridged output. |

## Removed (pruned for React Native)

Removed 2026-07-05 as irrelevant/conflicting for an RN build:

- **Web-DOM design** (Tailwind/shadcn/CSS/GSAP — don't exist in RN): `ui-styling`, `gpt-taste`, `imagegen-frontend-web`, `image-to-code`, `redesign-existing-projects`, `high-end-visual-design`, `design-system`.
- **Competing web style/taste skills**: `industrial-brutalist-ui`, `minimalist-ui`, `design-taste-frontend`, `design-taste-frontend-v1`, `stitch-design-taste`.
- **Marketing-asset generators**: `banner-design`, `brand`, `brandkit`, `slides`, `design`.
- **Emil design skills** (web animation/design): `animation-vocabulary`, `emil-design-eng`, `review-animations`.

Also removed: Impeccable's PostToolUse detector hook (was a web-CSS-oriented check firing on every edit).

## Reinstalling / managing

```bash
# React Native skills (Callstack)
npx skills add callstackincubator/agent-skills

# Obsidian skills (kepano)
npx skills add git@github.com:kepano/obsidian-skills.git

# ui-ux-pro-max
npm i -g ui-ux-pro-max-cli && uipro init -a claude

# Impeccable design skill
npx impeccable install

# Context7 live-docs MCP (Claude Code, project scope)
npx ctx7 setup --claude --mcp -p -y
```

## Environment note

This machine had no system Node or Homebrew. Node v24 (LTS) is installed under `~/.local`
with `node`/`npm`/`npx` on PATH, and npm's global prefix is set to `~/.local` so
`npm i -g` binaries land on PATH.
