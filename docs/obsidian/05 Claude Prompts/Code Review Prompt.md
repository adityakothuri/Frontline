---
tags: [claude, prompts, review]
status: stable
updated: 2026-07-05
---

# Code Review Prompt

Use to review a diff for anti-AI-slop and correctness. Backed by the `/slop-check` skill.

> Note: `/slop-check` is the **project anti-slop reviewer** (kept separate so the powerful
> built-in `/code-review` multi-agent reviewer stays available for deeper correctness passes).

```text
/slop-check

Review the current changes for:
- AI-looking code (giant files, vague names like Thing/Data/Card2, fake complexity)
- Unauthorized new files (was approval given? see File Creation Policy)
- Unrelated changes bundled in
- Duplicate/near-duplicate logic or components
- Naming quality + consistency
- TypeScript safety (no stray any, real domain types)
- Whether the build log / app_walkthrough / decision log need updating

Report: what's clean, what's slop, exact file+line fixes, and a pass/needs-revision verdict.
```

## When to also use built-in `/code-review`

For a deeper, multi-agent correctness review of a branch/PR, use the bundled
`/code-review` (or `/code-review ultra`). `/slop-check` is the fast, project-specific
anti-slop gate; `/code-review` is the heavyweight correctness reviewer.

## Related

[[Anti-AI-Slop Code Rules]] · [[Finish Task Prompt]] · [[Claude Review Template]]
