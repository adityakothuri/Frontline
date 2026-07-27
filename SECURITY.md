# Security Policy

Frontline serves veterans and handles location and optional, self-provided profile data, plus
AI-generated guidance. Security, privacy, and trust are core product concerns, not afterthoughts.

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue.

```text
Security contact: adityakothuri3@gmail.com
```

Include: what you found, steps to reproduce, affected area, and potential impact. We'll
acknowledge and work on a fix before any public disclosure.

## Secrets

- **Never commit secrets or real API keys.** `.env*` is git-ignored.
- Use `.env.local` (or the deployment environment) for local/real values.
- `.env.example` contains **placeholders only** and is safe to commit — keep it that way.
- **Mobile apps ship their bundle**, so anything in the app is effectively public. Only
  **public client keys** (e.g. `EXPO_PUBLIC_*`) may live in app source.
- **The AI / Anthropic API key must never ship in the client.** Real LLM calls go through a
  server-side proxy; the app only holds the proxy URL. See
  [Environment Variables](docs/obsidian/03%20Technical/Environment%20Variables.md).

## Privacy & data minimization

- **Collect the minimum.** Frontline **never** asks for SSN, VA login credentials, bank/financial
  info, or a medical diagnosis.
- The veteran **profile is optional** and used only to personalize results — never to gatekeep.
- Location: prefer **ZIP entry**; if using device location, ask clearly and allow ZIP instead.
  Don't store precise location beyond the session.
- Profile/saved data lives **on-device** by default. Optional cross-device backup is **anonymous**:
  it is keyed by a random on-device UUID (no account, no email, no tracking) and stored in
  deny-all tables reachable only through the `sync` Edge Function.

## AI safety

- AI output is **simplified guidance — never legal, medical, financial, or government-certified
  advice**. Eligibility language stays hedged ("you *may* qualify… confirm with the official
  source"), and every AI surface is labeled.
- Frontline is a **navigator, not the VA / a government agency**, and must say so.

## Backend security posture

- **Row-Level Security is deny-by-default on every table.** `resources` and `zip_centroids` expose
  read-only `select` to `anon` (with `insert/update/delete` revoked); every other table
  (`saved_backups`, `profile_backups`, `rate_limits`, `ai_spend`, `resource_sources`,
  `resource_votes`, `geocode_cache`) is service-role-only with explicit deny-all policies.
- **No dynamic SQL.** All RPCs are parameterized SQL/PLpgSQL; every `SECURITY DEFINER` function pins
  `search_path = public`. The `sync` function validates `deviceId` against a UUID regex before it is
  ever interpolated into a PostgREST path.
- **Edge-function auth model (accepted, documented risk).** `ai` and `sync` run with `verify_jwt`
  off and gate on the project's **publishable anon key**, which is public by design (it ships in the
  app). This is inherent to a no-account architecture. The controls that matter are therefore:
  - **AI cost** — a per-IP rate limit (using the trusted right-most `x-forwarded-for` hop, not the
    spoofable left-most one) plus a **global hourly spend budget**. Both are intentionally
    *fail-open* (a database blip must never take AI down), so the **Anthropic console spend cap is
    the load-bearing hard backstop** — keep it set.
  - **Input abuse** — both functions bound caller-supplied payload size (AI prompt input, and the
    `sync` saved/profile blobs) and reject oversized requests with `413` before doing work.
  - **Sync confidentiality** — backups are readable only with the exact device UUID (unguessable),
    and the monotonic `updated_at` write path means a stale/empty push can't clobber good data.
- **Known limitation.** Community "found this helpful" votes take the `device_id` from the caller, so
  the aggregate is trustworthy only for honest clients; robust anti-ballot-stuffing would require a
  signed per-device token (out of scope for the no-account MVP) and the count is treated as a soft
  signal accordingly.
- **Secrets & logs.** The Anthropic key lives only in Edge Function secrets; the service-role key is
  never in the app; functions log `error.message` only — never full errors, payloads, or keys.

## Sensitive changes need extra review

Changes touching **location, the AI proxy/keys, any new data collection, authentication, or
permissions** require extra scrutiny in review — call them out explicitly in the PR (see the
"Risks / Follow-ups" section of the PR template) and record notable decisions in the
[Decision Log](docs/obsidian/08%20Decisions/Decision%20Log.md).

## Related

- [Environment Variables](docs/obsidian/03%20Technical/Environment%20Variables.md)
- [Trust, Safety & Privacy](docs/obsidian/01%20Product/Trust%20Safety%20and%20Privacy.md)
- [Product Principles](docs/obsidian/01%20Product/Product%20Principles.md)
