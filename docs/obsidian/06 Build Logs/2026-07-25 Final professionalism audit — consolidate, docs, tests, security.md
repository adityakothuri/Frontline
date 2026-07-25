---
tags: [build-log]
date: 2026-07-25
phase: "Submission hardening — final professionalism audit"
task: Consolidate branches to main + deep professionalism polish (docs, tests, security, tooling)
status: done
---

# 2026-07-25 — Final professionalism audit

## Task
Final, deep audit of the entire app (frontend, backend, server) for a professionalism competition.
Three parallel expert sweeps agreed: **the implementation is senior-level; the point-losing gaps are
stale docs, no tests, edge-function security hardening, and thin repo metadata.** Confirmed with the
user: consolidate the 3 outstanding branches into `main`, do the full scope, and deploy the security
hardening live.

## Workstreams

**WS0 — Consolidate to `main`.** Merged `feature/essentials-merge-data-hardening`,
`feature/frontend-audit-see-in-map`, and `chore/repo-setup-audit`. Code files were disjoint; resolved
the 3 append-only Obsidian doc conflicts by union. `main` is now the complete app.

**WS-A — Stale/contradicting docs (highest judge leverage).**
- **README** fully rewritten from "simulated data + templated AI, not built" to the real system:
  live Supabase data (~130k+ rows), real Claude inference via the `ai` proxy, ingestion pipeline,
  RLS, accurate stack/structure/getting-started.
- `CONTRIBUTING.md` scrubbed of scrapped camera-product copy; `refresh.sh` no longer says Feed America
  was dropped then runs it; `scripts/seed.ts` lists the real sources; fixed the "Map arrives in Phase
  5" and USAJOBS "future work" comments; `CLAUDE.md` + Command Center reflect Phases 0–10 complete.

**WS-B — Test suite.** Added Vitest + `vitest.config.ts` + a shared test factory; **35 unit tests**
across the pure logic (`geo`, `hours`, `resourceStatus`, `sortResults`, `needMapping`). CI now runs
typecheck+lint+test on Node 22 with npm cache (dropped the dead "detect app" scaffolding).

**WS-C — Backend security hardening (deployed live).**
- Rate-limit on the **trusted right-most** `x-forwarded-for` hop (was the spoofable left-most);
  **payload size caps** on the AI prompt input and the `sync` saved/profile blobs (→ 413);
  `Allow: POST` on 405; fixed stale "templated fallback" comments.
- `config.toml`: disabled the missing-file SQL seed; `minimum_password_length` 6→8 + note that Auth
  is unused. `SECURITY.md`: documented the RLS deny-by-default posture, the anon-key/Anthropic-console
  model as an accepted risk, and the honest vote-integrity limitation.
- **Deployed** `ai` (v9) + `sync` (v6) via MCP. Re-verified live: summary smoke test **200**;
  GET → **405 + Allow: POST**; oversized input → **413**.

**WS-D — Repo metadata & tooling.** `package.json`: description, keywords, author, license
(UNLICENSED, matches LICENSE), repository, bugs, `engines >=22`, `format:check`, prettier
`printWidth 100`. Added `.nvmrc` (22) + `.editorconfig`; ESLint now enforces `no-explicit-any` + no
empty catch.

**WS-E — Dedup + targeted fixes.** Fixed the real onboarding bug (final `saveDetails` now try/catch +
Alert, no more stranded spinner); `Chip` touch target 40→44; `BottomSheet` backdrop relabelled so a
screen reader doesn't hear two "Close" controls; extracted the triplicated env-file loader into
`ingestion/lib/env.ts`; `numberArg` rejects non-numeric flags.

## Quality checks
- `npm run verify` (typecheck + lint) **green**; `npm test` **35/35 green**.
- Live: AI proxy re-smoke-tested green post-deploy (200 / 405+Allow / 413).
- App: re-ran the consolidated build on an iOS sim — Discover (real cards + Essentials chip +
  See-in-map + veteran badges) and the Map tab (pins + preview) both render.
- Anti-slop: self-reviewed the diff (no `any` / `console.log` / TODO / placeholder); the qa-tester +
  ui-reviewer passes on the merged branches still hold.

## Deliberately scoped out (honest)
- Relocating the per-category colors from `types/*` into theme — they are documented display metadata
  kept with the category; moving 22 values into theme is churn/risk without a clear win.
- Cast-after-guard cleanups (`resource.phone as string`) — idiomatic where TS can't narrow through a
  closure; left as-is.
- Full anti-ballot-stuffing on votes + a stronger AI auth gate (Turnstile/device token) — architectural
  (needs a product decision); documented as accepted risk in `SECURITY.md` rather than faked.

## Logs updated
- [x] this build log · [x] `app_walkthrough` · [x] Decision Log · [x] Command Center · [x] CHANGELOG · [x] SECURITY.md

## Known follow-up (pre-existing, not a regression)
Deep-linking **directly** to the Discover tab before the on-device profile hydrates fires the browse
with no ZIP (an unbounded nationwide query) and can error. The normal Home-first flow (profile loads
before Discover is shown) works — verified on the sim (Discover cards, Essentials chip, See-in-map,
veteran badges, and the Map tab all render). Worth hardening later (defer the first browse until the
profile is ready, or bound the no-origin query), but it predates this audit.

## Next step
`main` is the complete, polished submission. Remaining is release engineering (EAS, Android Maps key,
store assets) — out of scope for this audit.
