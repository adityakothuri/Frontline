---
tags: [template, walkthrough]
status: template
updated: 2026-07-05
---

# App Walkthrough Template

Copy the block below into [[app_walkthrough]] for each new feature (newest at the bottom).
This is the per-feature entry format. See [[Finish Task Prompt]] for when it's required.

---

```md
## <Feature Name>

### Date Added
YYYY-MM-DD

### Purpose
What this feature is and what user problem it solves.

### User Flow
Step by step, how the user moves through it (relate to [[App Flow]]).

### Important Files
| File | Purpose |
|---|---|
| path/to/file | what it does |

### How The Code Works
Plain-English explanation of the implementation — the key logic, not a line-by-line dump.

### Data Flow
How data moves: source (mock/service) → hook/state → screen → action. Where it's stored.

### Important Types / Components / Functions
The domain types, components, and functions someone needs to know to work on this.

### Temporary or Mock Parts
What is `mock`/`demo`/`simulated` vs production-ready, and how to tell.

### How To Extend This Later
Concrete pointers for the next developer (e.g. "swap mock service X for the real one behind
the same interface").

### Related Logs
Build log: [[YYYY-MM-DD <task>]]

### Related Decisions
[[Decision Log]] entries that shaped this.

### Risks / Notes
Confusing parts, sharp edges, or things to watch.
```

## Related

[[app_walkthrough]] · [[Build Log Template]] · [[Feature Spec Template]]
