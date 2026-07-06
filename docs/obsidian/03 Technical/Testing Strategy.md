---
tags: [technical, testing]
status: draft
updated: 2026-07-05
---

# Testing Strategy

Pragmatic testing for a demo-focused MVP. **Do not over-test simulated code**, but do protect
the logic that would hurt to break.

## MVP priorities

1. **Type safety first.** TypeScript is the primary safety net. Model the domain well and let
   `tsc` catch most errors. See [[Anti-AI-Slop Code Rules]].
2. **Manual flow verification.** Run the app and walk the [[App Flow]] loop. Reviewers must
   actually exercise flows, not assume.
3. **Targeted unit tests** for pure logic that's easy to get wrong: expiration math,
   detection→alert mapping, filtering expired alerts, confidence/severity formatting.

## What NOT to do (MVP)

- No exhaustive UI snapshot suites for screens still changing.
- No E2E harness (Detox/Maestro) until the flow stabilizes — Post-MVP.
- No tests for throwaway mock scaffolding.

## When tests are added

- A `test` script must be real (not the placeholder `"Error: no test specified"`), or the
  quality hook skips it. See [[Quality Gates]].
- Co-locate tests with the feature (`feature/__tests__/` or `*.test.ts`).
- New test setup/tooling is a **new-file decision** → approval required ([[File Creation Policy]]).

## Related

[[Quality Gates]] · [[Production Workflow]] · [[Technical Architecture]]
