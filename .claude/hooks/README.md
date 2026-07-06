# Post-Edit Quality Check Hook

## What it does

`quality-check.sh` runs the project's own quality scripts after Claude edits a
file, acting as a fast quality gate. It **only runs scripts that already exist**
in `package.json` — it never installs anything, never formats, and never
modifies files.

Check order (each skipped gracefully if absent):

1. `typecheck`
2. `lint`
3. `test` — skipped if the `test` script is a placeholder
   (e.g. the default `"Error: no test specified" && exit 1`)

It auto-detects the package manager from lockfiles
(`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lock(b)` → bun, else npm).

If there is no `package.json` (e.g. before the app is scaffolded), the hook
prints a notice and exits `0`.

## When it runs

Configured in [`.claude/settings.json`](../settings.json) as a **`PostToolUse`**
hook matching `Edit`, `Write`, and `MultiEdit`. It runs **after** Claude edits a
file — not before every tool call. It does **not** run on read-only operations.

## Which scripts it looks for

Only these npm scripts, and only if defined in `package.json`:
`typecheck`, `lint`, `test`. Anything else is ignored. Long-running commands
(builds, bundling, native compiles) are intentionally **not** run.

## How to run it manually

```bash
.claude/hooks/quality-check.sh
```

Run it from the project root. It is safe to run at any time.

## Troubleshooting

- **"No package.json found. Skipping."** — Expected before the app exists.
  The hook is inert until an app with quality scripts is present.
- **A check fails** — The script exits non-zero and prints the failing section
  (`==> Running <script>`). Fix the reported typecheck/lint/test failures, then
  re-run manually to confirm. The hook is fail-fast: it stops at the first
  failing check.
- **Wrong package manager detected** — Ensure the correct lockfile exists
  (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock`/`bun.lockb`); npm is the default.
- **Hook didn't fire** — Restart Claude Code so it reloads
  `.claude/settings.json`, and confirm the file is executable
  (`chmod +x .claude/hooks/quality-check.sh`).

## Guarantees

- Read-only with respect to your source files — **it does not modify files**.
- Never auto-formats.
- Never installs dependencies.
- Fails clearly and loudly when a real quality check fails.
