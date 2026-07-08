---
tags: [technical, config, security]
status: active
updated: 2026-07-07
---

# Environment Variables

The MVP needs **no secrets** in the app (data is simulated locally and AI is templated). This note
sets the rules for when real config arrives — most importantly the **AI proxy** for real Claude
calls (Priority 6/7 going live) and the backend (Priority 10).

## Current state

- **No `.env` needed for the MVP.** Mock resource data is in-repo and typed; AI responses are
  templated on-device. Do not introduce env config until a real integration requires it — and then
  only with approval ([[File Creation Policy]]).

## The AI key rule (important)

- **A mobile app ships its bundle — anything in it is effectively public.** Therefore **the Claude /
  Anthropic API key must never live in the client.**
- Real LLM calls go through a **thin proxy/edge function** that holds the key server-side; the app
  calls the proxy. This is required before Phase 6/7 use real models. Until then, the `AiService`
  templated implementation runs entirely on-device. See [[AI Feature Design]].

## Rules for when env vars arrive

- Only ever put **public/anon** keys in the client. **Never** service-role keys, admin secrets, or
  the AI API key in the RN app.
- Use Expo's public env convention (`EXPO_PUBLIC_*`) for values safe to expose (e.g. the proxy URL).
- Provide a committed **`.env.example`** (no real values) documenting every variable; real `.env*`
  files are **git-ignored**.
- Document each variable's purpose and where it's used.

## Git ignore

```gitignore
.env
.env.local
.env.*.local
.mcp.json          # Context7 MCP config — contains an API key
```

⚠️ **Security note:** confirm `.mcp.json` is actually git-ignored **and** not already committed —
it holds a live Context7 API key. If it was committed, rotate the key and add it to `.gitignore`.
The Obsidian `.md` notes stay tracked; only `docs/obsidian/.obsidian/` is ignored.

## Related

[[Technical Architecture]] · [[AI Feature Design]] · [[Phase 10 Backend and Data Ingestion]] · [[Trust Safety and Privacy]] · [[File Creation Policy]]
