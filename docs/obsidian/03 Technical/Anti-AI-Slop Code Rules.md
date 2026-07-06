---
tags: [technical, quality, anti-slop, source-of-truth, must-follow]
status: stable
updated: 2026-07-05
---

# Anti-AI-Slop Code Rules

**Canonical coding standards.** Future code must not look AI-generated. Mirrored in `CLAUDE.md`
and enforced by `/slop-check`, `qa-tester`, and `react-native-architect`. Design counterpart:
[[Anti-AI-Slop Design Rules]].

## Avoid

- **Giant files** that do everything.
- **Vague names**: `Thing`, `Data`, `Stuff`, `Card2`, `handleStuff`, `utils2`.
- **Duplicate components** that do the same job in different places.
- **Random abstractions** / fake complexity / over-engineered architecture.
- **Huge inline style blocks** repeated everywhere instead of tokens/shared styles.
- **Unnecessary dependencies** (each dep is a new-file decision — [[File Creation Policy]]).
- **Dead code, unused files, commented-out graveyards.**
- **Unclear mock data** or mock data disguised as real integrations.
- **Inconsistent folder placement** and **mixed naming conventions.**
- **Unexplained business logic.**
- **Files created without a plan / source files created without approval.**
- **Unrelated changes** bundled into one task.

## Prefer

- **TypeScript-first**: real domain types are the contract; avoid `any`.
- **Feature-based organization** ([[Folder Structure]]).
- **Small, focused files**; split when a file stops being scannable.
- **Readable component names** that say what they render.
- **Consistent design tokens** ([[UI Design System]]) — not scattered magic values.
- **Simple, reusable components** — abstract on the *second* real use, not the first.
- **Realistic, clearly-labeled mock data** (`mock*` / `demo*`).
- **Obvious data flow** — a reader can trace screen → hook → data.
- **Comments only where logic is non-obvious.**
- Code a **student developer can follow after reading the docs**.
- **Production-minded without being overbuilt.**

## The standard

Act like a **careful senior engineer**, not a chaotic code generator. When in doubt, choose
the smaller, clearer, more honest option. Label simulation as simulation.

## `/slop-check` covers

AI-looking code · unauthorized files · unrelated changes · duplicate logic · giant files ·
naming quality · TypeScript safety · whether logs need updating.

## Related

[[File Creation Policy]] · [[Anti-AI-Slop Design Rules]] · [[Technical Architecture]] · [[Quality Gates]]
