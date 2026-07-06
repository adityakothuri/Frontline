# GitHub Setup

Recommended GitHub configuration for Watchdog. Nothing here changes the remote automatically —
these are steps/settings to apply **with approval**. Related:
[Branching Strategy](Branching%20Strategy.md) ·
[Pull Request Checklist](Pull%20Request%20Checklist.md) ·
[Release Process](Release%20Process.md).

## Repository visibility

- **Private during early development.** Do not make the repo public without explicit approval.
- Never expose secrets or private camera/security logic. `.env*` and `.mcp.json` are git-ignored.
- The license is **proprietary** (see [LICENSE](../../LICENSE)) until a decision to open-source.

## Create the remote (deferred — needs approval; `gh` is installed)

```bash
gh auth login                 # one-time GitHub authentication
gh repo create watchdog-app --private --source=. --remote=origin
# then, when you're ready to publish history:
# git add -A && git commit -m "chore: initial project brain + repo workflow"
# git push -u origin main
```

Do **not** run these without approval. `gh` (v2.96+) is installed at `~/.local/bin/gh`.

## Branch protection (apply after the remote exists)

**`main`:**
- Require a pull request before merging.
- Require the CI status check (`Verify`) to pass.
- Block force pushes.
- Require conversation resolution.
- Optionally require linear history.

**`dev`:**
- Require CI to pass.
- PR preferred (can be lighter than `main`).

## Recommended branches

```text
main               = stable / demo-able at all times
dev                = active development integration
feature/<task>     = one feature task
fix/<bug>          = one bug fix
docs/<doc>         = documentation
chore/<setup>      = tooling / config
```

See [Branching Strategy](Branching%20Strategy.md).

## Recommended labels (create with approval)

```text
type: feature      type: bug        type: docs      type: chore     type: refactor
priority: high     priority: medium priority: low
area: ui           area: backend    area: camera    area: ai-detection
area: alerts       area: map        area: auth      area: docs
status: blocked    status: needs-review           status: ready
mvp                future           privacy         security
```

Do not create labels remotely without approval. Once approved, they can be created via `gh`
or the GitHub UI.

## Follow-ups after the remote exists

- Update `.github/ISSUE_TEMPLATE/config.yml` `contact_links` URLs to point at the real repo
  files (e.g. `.../blob/main/SECURITY.md`).
- Consider the optional upgrades in the setup report (CodeQL, secret scanning, Projects board,
  milestones) — add only when lightweight and approved.
