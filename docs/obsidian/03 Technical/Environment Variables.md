---
tags: [technical, config, security]
status: stable
updated: 2026-07-05
---

# Environment Variables

The MVP needs **no secrets** (everything is simulated locally). This note sets the rules for
when real config arrives (Priority 9+).

## Current state

- **No `.env` needed for the MVP.** Mock data is in-repo and typed. Do not introduce env config
  until a real integration requires it — and then only with approval ([[File Creation Policy]]).

## Rules for when env vars arrive

- **Mobile apps ship their bundle** — anything in the app is effectively public. Only ever put
  **public/anon** keys in the client (e.g., Supabase anon key). **Never** service-role keys,
  admin secrets, or private API keys in the RN app.
- Use Expo's public env convention (`EXPO_PUBLIC_*`) for values that are safe to expose, and
  keep genuinely secret operations on a backend/edge function.
- Provide a committed **`.env.example`** (no real values) documenting every variable. The real
  `.env*` files are **git-ignored** (see repo `.gitignore`).
- Document each variable's purpose and where it's used.

## Git ignore (already configured)

```gitignore
.env
.env.local
.env.*.local
.mcp.json          # Context7 MCP config — contains an API key
```

The Obsidian `.md` notes stay tracked; only `docs/obsidian/.obsidian/` is ignored.

## Related

[[Technical Architecture]] · [[Phase 7 Backend Integration]] · [[Release Workflow]] · [[File Creation Policy]]
