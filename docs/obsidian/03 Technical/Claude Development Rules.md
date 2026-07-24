---
tags: [technical, claude, rules, source-of-truth]
status: active
updated: 2026-07-07
---

# Claude Development Rules (Frontline)

The canonical rules for how Claude builds Frontline. Mirrors the summary in
[`CLAUDE.md`](../../../CLAUDE.md); this is the vault-side source of truth. Because Frontline serves
veterans, these are not optional.

## Product truth

- The app is **Frontline**. It helps **veterans find benefits and local resources**.
- The MVP is: **guided help flows, local resource discovery, AI summarization, generated call
  scripts, saved resources, and trust/verification**. See [[MVP Definition|MVP Scope]].

## How to build

1. **AI is embedded into workflows, never a chatbot.** Every AI touchpoint is a specific
   workflow output (plan, script, summary). See [[AI Feature Design]].
2. **Build carefully, feature by feature.** One task at a time. No "build everything" sprints.
3. **No random files.** Every file has a purpose; new app files need approval with path + purpose +
   contents stated first. See [[File Creation Policy]].
4. **No massive unrelated changes.** Keep diffs scoped to the approved task.
5. **Preserve the framework.** Agents, hooks, rules, skills, MCP, Obsidian, and the workflow stay
   intact unless explicitly told otherwise.
6. **Update docs when product/architecture decisions change** — build log + [[app_walkthrough]] at
   minimum; [[Decision Log]] when a decision is made. See [[Production Workflow]].

## Non-negotiables (veterans)

7. **Accessibility, clarity, trust, privacy** come first in every screen. See [[Product Principles]].
8. **Avoid collecting sensitive data.** Never SSN, VA login, bank info, or diagnosis; profile fields
   are optional and personalize only. See [[Trust Safety and Privacy]].
9. **Never present AI output as legal, medical, financial, or government-certified advice.** Hedge
   eligibility; label AI output; show source + last-checked on every resource.
10. **Honest simulation.** Label `mock` / `demo` / `simulated` / `templated`; never dress a fake
    integration as real. See [[Anti-AI-Slop Code Rules]].

## Related

[[Product Principles]] · [[AI Feature Design]] · [[Trust Safety and Privacy]] · [[File Creation Policy]] · [[Anti-AI-Slop Code Rules]]
