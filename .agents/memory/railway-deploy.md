---
name: Railway / external single-service deploy
description: How this pnpm monorepo deploys as ONE service (server+client+Postgres) outside Replit, without breaking Replit.
---

# Deploying outside Replit (Railway etc.) as a single service

This monorepo can run the API server and the Vite client from **one** Node service
(plus an external Postgres), so a non-Replit host needs only 1 web service + 1 DB.

**Why single-service:** cheapest + simplest for the user (one domain, no CORS, no
separate `VITE_API_URL`). The client's `getApiUrl()` falls back to
`window.location.origin`, so same-origin "just works" when served by the server.

## How to apply
- **Force pnpm, never npm.** Root `preinstall` hard-blocks npm (because of
  `workspace:*` deps). The fix on any host is to make it use pnpm — done via
  `packageManager: "pnpm@..."` + `engines.node` in root `package.json`, plus the
  `pnpm-lock.yaml`. Telling the user to "switch to npm" is wrong and impossible.
- **Build/run:** root scripts `build:railway` (builds client then server via
  esbuild) and `start:railway` (sets `SERVE_CLIENT=1` then runs
  `artifacts/api-server/dist/index.cjs`). `railway.json` wires these into Nixpacks.
  Build deliberately skips `typecheck` (there is a preexisting unrelated
  tournaments.ts typecheck error that would otherwise block it).
- **Static serving is gated:** `app.ts` only serves `stop-game/dist/public` + SPA
  fallback when `SERVE_CLIENT=1`. Replit never sets it → Replit topology (separate
  Vite service) is untouched. Keep this gate; do not serve static unconditionally.
- **Stripe webhook host** in `index.ts` falls back to `RAILWAY_PUBLIC_DOMAIN`
  (auto-injected by Railway) and strips any `https://` prefix.
- **User must do on the host (cannot be automated):** create Postgres, paste all
  ~10 secrets (Stripe, Google/Facebook/Instagram/TikTok OAuth, web-push, OpenAI),
  set `DATABASE_URL` + `APP_ORIGIN`, point DNS, and re-register the new domain in
  every OAuth provider + Stripe + Google Play. DB schema self-bootstraps via
  `ensureIndexes()` on boot.
