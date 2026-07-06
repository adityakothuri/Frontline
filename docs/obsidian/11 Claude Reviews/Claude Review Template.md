---
tags: [template, review]
status: template
updated: 2026-07-05
---

# Claude Review Template

Copy into `11 Claude Reviews/` to record a review pass (from `/slop-check`, `qa-tester`,
`ui-reviewer`, or built-in `/code-review`). Naming: `YYYY-MM-DD <area> review.md`.

---

```md
---
tags: [review]
date: YYYY-MM-DD
reviewer: slop-check | qa-tester | ui-reviewer | code-review
area: <feature/area>
verdict: pass | needs-revision
---

# Review: <area> — <YYYY-MM-DD>

## Scope reviewed
Files / feature / diff reviewed.

## What's clean
- ...

## Issues found
| Severity | File:line | Issue | Fix |
|----------|-----------|-------|-----|
| high/med/low | path:NN | ... | ... |

## Anti-slop checks
- [ ] No giant files
- [ ] Clear naming (no Thing/Data/Card2)
- [ ] No duplicate logic/components
- [ ] TypeScript safety (no stray `any`)
- [ ] No unauthorized files ([[File Creation Policy]])
- [ ] No unrelated changes
- [ ] Believable, labeled mock data

## Design checks (if UI)
- [ ] Hierarchy / spacing / type consistency ([[Anti-AI-Slop Design Rules]])
- [ ] Loading / empty / error states
- [ ] Color meaning respected

## Verdict
pass / needs-revision + required fixes.

## Logs
Build log: [[…]] · Walkthrough updated? [[app_walkthrough]]
```

## Related

[[Code Review Prompt]] · [[Anti-AI-Slop Code Rules]] · [[Anti-AI-Slop Design Rules]]
