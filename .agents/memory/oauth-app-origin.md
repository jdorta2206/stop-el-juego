---
name: OAuth APP_ORIGIN must default to a live registered origin
description: Why social login broke with the Replit "Run this app" placeholder
---

# OAuth runs on APP_ORIGIN; its fallback must be live + registered

Social login (Google/Facebook/Instagram) in `artifacts/api-server/src/routes/auth.ts`
builds every `redirect_uri` as `${APP_ORIGIN}/api/auth/<provider>/callback`, and
the providers only accept the ONE origin registered in their consoles. After auth,
the bridge page bounces the user back to whatever `SAFE_RETURN_ORIGINS` they came
from (e.g. www.stopjuegodepalabras.com / the TWA) via the `state` param.

`APP_ORIGIN` comes from env per-environment:
- `.replit` `[userenv.development]` → the Replit dev-preview domain
- `.replit` `[userenv.production]` → `https://stop-el-juego.replit.app`
- External host (Railway, serving www) → set in Railway's own dashboard

**Why this broke:** the hardcoded code fallback used to be the dev-preview
domain. Any deploy where `APP_ORIGIN` was unset (the external host serving www)
fell back to that stopped dev workspace, so social login landed on Replit's
"Ejecuta esta aplicación" placeholder.

**How to apply:** the fallback default must always be a LIVE, console-registered
production origin (`https://stop-el-juego.replit.app`), never a dev-preview URL.
The registered redirect_uri in the OAuth consoles is the binding constraint — it
must match APP_ORIGIN exactly; adding a brand-new origin requires registering its
`/api/auth/*/callback` URLs in each provider console first. Code changes only take
effect after the affected host (Replit deployment AND/OR Railway) is re-deployed.
