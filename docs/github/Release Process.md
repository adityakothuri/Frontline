# Release Process

**Not active yet.** This documents the *future* release flow so it's ready when Frontline is
demo-/ship-ready. Do not set up real releases without approval. Related:
[GitHub Setup](GitHub%20Setup.md) ·
[Branching Strategy](Branching%20Strategy.md) ·
[Release Workflow](../obsidian/03%20Technical/Release%20Workflow.md).

## Versioning ladder

```text
0.1.0 = first MVP demo (simulated loop, polished)
0.2.0 = real backend integration
0.3.0 = real AI / video prototype
1.0.0 = public-ready MVP
```

Semantic versioning: MAJOR.MINOR.PATCH.

## Future release flow

1. Merge feature/fix branches into **`dev`**.
2. Verify a **preview/dev build** and walk the core flow (see
   [App Flow](../obsidian/02%20Design/App%20Flow.md)).
3. Update **[CHANGELOG.md](../../CHANGELOG.md)** — move `[Unreleased]` items under a new version.
4. Create a **`release/x.y.z`** branch if stabilization is needed.
5. Merge to **`main`** via PR (CI green, reviews done, logs updated).
6. **Tag** the version: `git tag vX.Y.Z` (annotated), push the tag.
7. Create a **GitHub release** from the tag with notes drawn from the changelog
   (`gh release create vX.Y.Z --notes-file ...`).
8. **Future:** EAS build/submit for store distribution (see
   [Release Workflow](../obsidian/03%20Technical/Release%20Workflow.md) and the
   `release-manager` agent + `github-actions` skill). Verify EAS commands with Context7.

## Guardrails

- Never force-push or rewrite released history.
- No secrets in the app bundle — only public `EXPO_PUBLIC_*` keys (see
  [SECURITY.md](../../SECURITY.md)).
- A release is a deliberate, reviewed action — not automated until approved.

## Related

[Release Workflow](../obsidian/03%20Technical/Release%20Workflow.md) ·
[Branching Strategy](Branching%20Strategy.md) ·
[GitHub Setup](GitHub%20Setup.md) ·
[Environment Variables](../obsidian/03%20Technical/Environment%20Variables.md)
