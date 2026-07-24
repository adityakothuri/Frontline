# Pull Request Checklist

A human-readable guide to [.github/pull_request_template.md](../../.github/pull_request_template.md).
Every PR reinforces the workflow — fill each section honestly. Related:
[Branching Strategy](Branching%20Strategy.md) ·
[Release Process](Release%20Process.md) ·
[Production Workflow](../obsidian/03%20Technical/Production%20Workflow.md).

## Summary
What the PR does and why, in a couple of sentences. Keep it to **one task**.

## Related Issue / Task
Link the issue/task and the roadmap phase (e.g.
[Phase 1 App Shell](../obsidian/04%20Build%20Roadmap/Phase%201%20App%20Shell.md)). Reviewers
should be able to see the scope that was approved.

## Type of Change
Feature / Fix / Refactor / Docs / Chore. Pick one — a PR that's several types at once is
probably too big.

## Scope Control
- **Only the approved scope changed.** No opportunistic edits.
- **No unrelated features.** File a separate task instead.
- **New files were approved or explained** — per the
  [File Creation Policy](../obsidian/03%20Technical/File%20Creation%20Policy.md).

## Quality Checks
- **Typecheck / Lint / Tests** pass (where available and meaningful). CI runs these too.
- **Manually ran the app** and exercised the flow for anything with runtime behavior — a green
  typecheck is not proof it works.

## UI Review
For visual changes, confirm spacing, hierarchy, loading/empty/error states, and consistency
against the [UI Design System](../obsidian/02%20Design/UI%20Design%20System.md) and
[Anti-AI-Slop Design Rules](../obsidian/02%20Design/Anti-AI-Slop%20Design%20Rules.md). Use the
`ui-reviewer` agent.

## Obsidian Updates
- **Build log** updated (`docs/obsidian/06 Build Logs/`).
- **app_walkthrough** updated if a meaningful feature/code change (new screen, feature folder,
  flow, state, API, navigation, design-system, reusable pattern, important refactor, or a bug
  fix that changes a flow).
- **Decision log** updated if an architecture/product decision was made.
- **Bug log** updated if a bug was found/fixed.

## Screenshots / Videos
Include them for UI changes.

## Risks / Follow-ups
Call out anything reviewers should scrutinize — **especially AI output, location, privacy, auth,
permissions, or anything affecting what becomes public** (see [SECURITY.md](../../SECURITY.md)).

## Related

[Branching Strategy](Branching%20Strategy.md) ·
[Production Workflow](../obsidian/03%20Technical/Production%20Workflow.md) ·
[GitHub Setup](GitHub%20Setup.md)
