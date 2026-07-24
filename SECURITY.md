# Security Policy

Frontline serves veterans and handles location and optional, self-provided profile data, plus
AI-generated guidance. Security, privacy, and trust are core product concerns, not afterthoughts.

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
- MVP profile/saved data lives **on-device** — no account, no server, no tracking.

## AI safety

- AI output is **simplified guidance — never legal, medical, financial, or government-certified
  advice**. Eligibility language stays hedged ("you *may* qualify… confirm with the official
  source"), and every AI surface is labeled.
- Frontline is a **navigator, not the VA / a government agency**, and must say so.

## Sensitive changes need extra review

Changes touching **location, the AI proxy/keys, any new data collection, authentication, or
permissions** require extra scrutiny in review — call them out explicitly in the PR (see the
"Risks / Follow-ups" section of the PR template) and record notable decisions in the
[Decision Log](docs/obsidian/08%20Decisions/Decision%20Log.md).

## Related

- [Environment Variables](docs/obsidian/03%20Technical/Environment%20Variables.md)
- [Trust, Safety & Privacy](docs/obsidian/01%20Product/Trust%20Safety%20and%20Privacy.md)
- [Product Principles](docs/obsidian/01%20Product/Product%20Principles.md)
