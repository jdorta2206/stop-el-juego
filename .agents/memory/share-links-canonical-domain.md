---
name: Shareable links must use the canonical public domain
description: Why invite/room/share links must never be built from window.location.origin
---

# Shareable links → canonical domain, never origin

User-facing shareable links (friend invites with `?ref&from`, room `/room/CODE`,
live/overlay, tournament `/torneo/CODE`, "imposible" share, result-share fallback)
must be built with `publicLink()` / `PUBLIC_SITE_URL` from `src/lib/utils.ts`, NOT
from `window.location.origin + import.meta.env.BASE_URL`.

**Why:** when a link is generated while the app is open on the Replit editor
PREVIEW domain (`*.replit.dev`), `window.location.origin` captures that dev host.
The shared link then points at the dev preview, which shows the "Ejecuta esta
aplicación" placeholder once the workspace stops — broken for whoever clicks it.
Reported in production (stopjuegodepalabras.com).

**How to apply:** production serves at root (`vite base = process.env.BASE_PATH ||
"/"`), so `publicLink("room/CODE")` → `https://www.stopjuegodepalabras.com/room/CODE`.
Do NOT migrate runtime-origin-sensitive code: API base (`getApiUrl`), OAuth
redirect, and push-notification origin must keep using `window.location.origin` /
`VITE_API_URL`. Already-shared old links can't be fixed retroactively.
