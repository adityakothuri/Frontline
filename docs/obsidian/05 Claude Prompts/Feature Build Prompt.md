---
tags: [claude, prompts]
status: stable
updated: 2026-07-05
---

# Feature Build Prompt

Use when building a whole feature (bigger than a single small task). Walks the full workflow.

```text
Feature: <feature name> (from the roadmap phase: <Phase X>)

1. product-manager: confirm this is in scope for the current phase and MVP. Define the
   exact scope, what's excluded, and the definition of done. Write/append a feature spec
   (docs/obsidian/12 Feature Specs/) using the Feature Spec Template.

2. react-native-architect: propose the implementation. List NEW files/folders/dependencies
   with path + purpose + contents. Verify any library APIs with Context7. WAIT for my
   approval on new files/deps.

3. Implement ONLY the approved scope. Typed, small files, feature-based folder, believable
   mock data, design tokens. Label simulation as mock/demo.

4. Quality checks (typecheck/lint/test). Run the app and walk the flow.

5. ui-reviewer (anti-slop design pass) + qa-tester + /slop-check.

6. /finish-task: build log + app_walkthrough entry + decision/bug logs if needed + update
   Command Center. List risks + next step.
```

## Related

[[Start Task Prompt]] · [[Finish Task Prompt]] · [[Feature Spec Template]] · [[Feature Priority Order]]
