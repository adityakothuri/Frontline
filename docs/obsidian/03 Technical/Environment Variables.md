---
tags: [technical, config, security]
status: active
updated: 2026-07-07
---

# Environment Variables

The MVP needs **no secrets** in the app (data is simulated locally and AI is templated). This note
sets the rules for when real config arrives — most importantly the **AI proxy** for real Claude
calls (Priority 6/7 going live) and the backend (Priority 10).

## Current state (Phase 10.1, 2026-07-15)

- **`.env` is optional and is the mode switch.** With no env, the app runs fully offline
  (mock resources + templated AI). Setting `EXPO_PUBLIC_SUPABASE_URL` +
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` flips both service factories to the real backend
  (`src/services/supabase/config.ts`). `.env.example` is the committed documentation of record.
- **⚠️ Use the PUBLISHABLE key, not the legacy JWT.** `EXPO_PUBLIC_SUPABASE_ANON_KEY` must be the
  modern `sb_publishable_…` key. The edge functions self-gate on the injected `SUPABASE_ANON_KEY`
  (which is the publishable key); the legacy anon JWT passes PostgREST reads but is **401'd by the
  functions**, silently disabling AI + sync in the app. This bit us once — see the 2026-07-15 build log.
- **The AI proxy exists**: `supabase/functions/ai` holds `ANTHROPIC_API_KEY` as a Supabase secret,
  plus optional model + budget knobs (below). The `sync` function needs no extra secrets. The seed
  script uses `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` from a git-ignored `.env.seed`.
- **AI cost knobs (function secrets, all optional):** `ANTHROPIC_MODEL` (Opus default for
  plan/script), `ANTHROPIC_MODEL_SUMMARY` (`claude-haiku-4-5`), `ANTHROPIC_MODEL_PLAN`/`_SCRIPT`
  overrides, and **`AI_HOURLY_BUDGET_USD`** (global hourly Claude spend cap, default 5; read at
  runtime — no redeploy to change). Set a **monthly cap in the Anthropic console** as the hard backstop.
- **Expo inlining caveat:** `EXPO_PUBLIC_*` values are baked at bundle time — literal property
  reads only, restart the dev server after edits, and set them in EAS env for cloud builds.
- **Full var table + runbooks:** see [[Backend to Production Master Plan]] §4 and §7.

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
