---
name: Cross-origin OAuth session handoff via URL hash
description: Why social login "completes but doesn't stick" when OAuth domain != app domain
---

# OAuth runs on one origin, user lands on another → handoff must use the URL

Social login runs on the canonical OAuth origin (`APP_ORIGIN` =
stop-el-juego.replit.app — the only redirect_uri registered in the provider
consoles), then bounces the user back to whatever `SAFE_RETURN_ORIGIN` they came
from (e.g. www.stopjuegodepalabras.com / the TWA).

**Symptom when broken:** login completes on Google/Facebook/Instagram, returns to
the app, but the user is dumped back on the login screen — the session "doesn't
stick".

**Why:** the server bridge page wrote the session token + `oauth_user` to
`sessionStorage`/`localStorage`, but those are **per-origin**. They were written
on the OAuth origin and the user lands on a *different* origin where that storage
is empty. The httpOnly `sameSite=None` cookie is also a *third-party* cookie on
the destination origin and is blocked by Safari/mobile, so cookie-based restore
isn't reliable either.

**Fix (the only reliable cross-origin channel is the URL):** the bridge also
encodes all handoff items in the URL **hash** (`#stopauth=<encoded JSON [[k,v]]>`).
The destination imports them into its OWN storage on load via
`consumeAuthHandoff()` (called in `main.tsx` BEFORE React mounts, so usePlayer
restore + AuthModal see them), then strips the hash with `replaceState`.

**How to apply / invariants:**
- Hash key→store mapping MUST match the server bridge: `stop_session_token` →
  localStorage; everything else (`oauth_user`, `fb_access_token`) → sessionStorage.
- `consumeAuthHandoff()` must run before any session read.
- Hash (not query) so the token is never sent to servers/access logs; strip it
  immediately.
- Safe against forgery: the token is HMAC-signed (SESSION_SECRET) server-side, so
  a hand-crafted `stopauth` hash can't mint a valid session — it just fails
  verification.
- Takes effect only after BOTH hosts (Replit deployment AND the external host
  serving www, e.g. Railway) are re-deployed.
