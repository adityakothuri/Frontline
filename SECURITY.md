# Security Policy

Watchdog handles cameras, video, location, and neighborhood-safety data. Security and privacy
are core product concerns, not afterthoughts.

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue.

```text
Security contact: TBD
```

(Replace with a real private contact/email before the repo is shared or made public. Until
then, report privately to the repository owner.)

Include: what you found, steps to reproduce, affected area, and potential impact. We'll
acknowledge and work on a fix before any public disclosure.

## Secrets

- **Never commit secrets or real API keys.** `.env*` is git-ignored.
- Use `.env.local` (or the deployment environment) for local/real values.
- `.env.example` contains **placeholders only** and is safe to commit — keep it that way.
- **Mobile apps ship their bundle**, so anything in the app is effectively public. Only
  **public client keys** (e.g. `EXPO_PUBLIC_SUPABASE_ANON_KEY`) may live in app source.
- **Service-role / admin / backend secrets must never appear in app source** — keep privileged
  operations on a backend or edge function.

## Privacy & camera/video

- **User approval is required before any footage or detection becomes public.** Nothing from a
  private camera is posted automatically.
- Raw private footage stays private unless the user intentionally posts it.
- Location handling must be privacy-conscious (coarse, permissioned).
- Alerts are temporary by design (auto-delete/expiration).

## Sensitive changes need extra review

Changes touching **camera/video handling, detection, location, authentication, permissions, or
anything that affects what becomes public** require extra scrutiny in review — call them out
explicitly in the PR (see the "Risks / Follow-ups" section of the PR template) and record
notable decisions in the [Decision Log](docs/obsidian/08%20Decisions/Decision%20Log.md).

## Related

- [Environment Variables](docs/obsidian/03%20Technical/Environment%20Variables.md)
- [Product Principles](docs/obsidian/01%20Product/Product%20Principles.md)
