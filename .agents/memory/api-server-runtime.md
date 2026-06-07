---
name: api-server dev runtime
description: How the STOP api-server runs in dev and how to reach it for smoke tests.
---

# api-server runtime

- Runs via `tsx ./src/index.ts` with **no watch** (NODE_ENV=development). Edits
  do NOT hot-reload — restart the `artifacts/api-server: API Server` workflow
  after changing server code.
- Binds to `PORT` (required, throws if unset). In dev it's **8080**.
- All routes are under `/api` (e.g. `/api/notifications/send-daily`). There is no
  `/api/health` (that probe path 404s — health is elsewhere/none).
- Smoke test locally with `curl http://localhost:8080/api/...`. The Replit dev
  domain proxy did not resolve to this port directly in testing.
