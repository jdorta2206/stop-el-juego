---
name: Private owner analytics panel (/test)
description: How the hidden stats dashboard is wired and what it needs to work on Railway
---

There is an owner-only analytics dashboard at `GET /test` (HTTP Basic Auth), served by
the api-server (not under `/api`). It shows daily registered-active / new-signups /
games, guest activity (from `guest_stats`), historical totals, and a top-10.

**Wiring constraints:**
- Mounted in `app.ts` BEFORE the `SERVE_CLIENT` SPA fallback, and NOT under `/api` — the
  SPA catch-all (`/^\/(?!api...)/`) would otherwise swallow it and return index.html.
- Auth fails CLOSED: if `ADMIN_PANEL_USER`/`ADMIN_PANEL_PASSWORD` are unset → 503, never open.
- Bots (`player_id LIKE 'bot_%'`) are excluded from all counts; "today" uses Europe/Madrid.

**To work on www (Railway) it needs BOTH (separate from Replit):**
1. `ADMIN_PANEL_USER` + `ADMIN_PANEL_PASSWORD` set as Railway variables (same as Replit secrets).
2. `DATABASE_URL` pointing at a reachable DB (the Railway Postgres) — otherwise it 500s
   like every other DB route.

**Dev testing note:** on Replit dev the client (Vite) and api-server are separate services,
so `https://<dev-domain>/test` hits the SPA (200, wrong). Test the api-server directly on
its own port (e.g. `curl -u user:pass http://localhost:<api-port>/test`).
