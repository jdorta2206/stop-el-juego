# STOP — El Juego

Full-stack multiplayer **STOP** (Tutti Frutti / Scattergories) word game. Players
race to fill 7 categories with words starting from a random letter, against an AI
or other players in real time.

- **Frontend:** React + Vite (`artifacts/stop-game`)
- **API:** Express 5 (`artifacts/api-server`)
- **DB:** PostgreSQL + Drizzle ORM (`lib/db`)
- **Shared:** OpenAPI spec + Orval codegen (`lib/api-spec`, `lib/api-client-react`, `lib/api-zod`)
- **Monorepo:** pnpm workspaces (Node 24, TypeScript 5.9)

## Prerequisites

- Node.js 24
- pnpm (`packageManager` is pinned in `package.json`)
- A PostgreSQL database

## Install

```bash
pnpm install
```

## Run in development

Each artifact runs as its own service. On Replit they are started by the
configured workflows; locally you can run them directly:

```bash
# API server (Express)
pnpm --filter @workspace/api-server run dev

# Web client (React + Vite)
pnpm --filter @workspace/stop-game run dev
```

Each service binds to the `PORT` environment variable assigned to it.

## Environment variables

Set these as secrets (never commit values). The API fails *open* where it safely
can, so missing optional keys disable a feature rather than crash the server.

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection (required) |
| `SESSION_SECRET` | Signs session tokens **and** the OAuth `state` nonce (≥16 chars; must be identical across all hosts) |
| `APP_ORIGIN` | Canonical OAuth origin (the only `redirect_uri` registered with providers) |
| `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google login |
| `VITE_FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook login |
| `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET` | Instagram login (disabled in client) |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | TikTok login (disabled in client) |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | Apple Sign In (optional) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | Web Push notifications |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | Premium subscriptions |
| `ADMIN_PANEL_USER` / `ADMIN_PANEL_PASSWORD` | Admin panel basic auth |

## Tests

Unit tests run with [Vitest](https://vitest.dev):

```bash
pnpm test                                   # all packages
pnpm --filter @workspace/api-server test    # API server only
```

Tests cover the critical pure game logic (answer normalization and input safety
in `artifacts/api-server/src/lib/wordRules.ts`).

## Typecheck & build

```bash
pnpm run typecheck   # type-check every package
pnpm run build       # typecheck + build all packages
```

## Codegen & DB

```bash
pnpm --filter @workspace/api-spec run codegen   # regenerate hooks/schemas from openapi.yaml
pnpm --filter @workspace/db run push            # push Drizzle schema to the database
```

## Deployment

The same client is served to two production hosts via **separate** pipelines:

- **stop-el-juego.replit.app** — Replit Deployment. Canonical OAuth host.
  Published directly from Replit (Republish). Does **not** use GitHub.
- **www.stopjuegodepalabras.com** — Railway. The API runs in single-service mode
  (`SERVE_CLIENT=1`) and serves the built client. Railway deploys from GitHub.

Any client change must reach **both** pipelines to be live everywhere (including
the Android TWA, which loads the Railway host). `SESSION_SECRET` must match across
hosts so OAuth handoff tokens issued on one host verify on the other.

## Auth notes

OAuth runs on `APP_ORIGIN` and bounces the user back to whatever allow-listed
origin they came from, carrying the session handoff in the URL hash (storage is
per-origin). The `state` parameter is HMAC-signed (with `SESSION_SECRET`) and, on
the same-origin path, bound to a single-use httpOnly nonce cookie for CSRF
protection.
