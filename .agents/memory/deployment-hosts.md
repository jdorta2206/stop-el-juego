---
name: Deployment hosts & client sharing
description: How the STOP game's two production hosts relate and deploy, so client changes are shipped to the right place.
---

# Two production hosts, one client, two pipelines

The STOP (Scattergories) project serves the **same** stop-game client to two
production hosts, but through **different** deploy pipelines:

- **stop-el-juego.replit.app** — Replit Deployment. Canonical OAuth host. Published
  **directly from Replit** (Publish / Republish button). Does **NOT** use GitHub.
  Do not turn it off.
- **www.stopjuegodepalabras.com** — Railway. `api-server` runs in single-service
  mode (`SERVE_CLIENT`) and serves the built client from
  `artifacts/stop-game/dist/public`. Railway deploys **from GitHub**.

**Why this matters:** any change to the `artifacts/stop-game` client ships to BOTH
hosts, but you must trigger BOTH pipelines: republish on Replit for the .replit.app
host, and get the commit to GitHub (Railway auto-deploys) for the www host. The
agent cannot run git here (`.git` is guarded), so the GitHub push is a manual user
step and has repeatedly been blocked (UNAUTHENTICATED = reconnect GitHub; PUSH_REJECTED
= Pull before Push).

**How to apply:** when a client change is "urgent" and GitHub is stuck, ship it via
the Replit republish (works independently of GitHub). Only the www/Railway host is
gated on GitHub.

## The Android app (TWA) loads the Railway host, not replit.app

The Play Store app (package `app.replit.stop_el_juego.twa`) loads
**stopjuegodepalabras.com (Railway)** as its start URL. So any client change must
reach **GitHub → Railway** to be visible *inside the app*. Publishing only to
stop-el-juego.replit.app is NOT enough — users won't see it. Diagnose "feature not
showing in the app" by checking whether the built JS on stopjuegodepalabras.com
contains the new code (e.g. `curl` the site, grep the bundle), and compare against
the latest commit on GitHub master.

**Why pushes keep getting rejected:** the user edits files directly in the GitHub
web UI (e.g. commit "Actualizar app.ts"), creating remote-only commits the repl
doesn't have → PUSH_REJECTED. The repl must **Pull (merge) before Push**. The agent
cannot run git (`.git` guarded), so this is a manual user step in the Git pane.

## www and the bare apex resolve to DIFFERENT backends

`www.stopjuegodepalabras.com` → Railway (the NEW app build; serves the latest client
incl. the update banner). The bare apex `stopjuegodepalabras.com` (no www) → a
SEPARATE legacy server with a BROKEN TLS cert — NOT Railway. So deploying to Railway
does NOT reach old-app users whose start URL is the bare apex. The OLD installed app
opens the bare apex; the NEW app opens www.

**Decision for the in-app "update" nudge:** the banner is gated by hostname — it is
hidden on `www.stopjuegodepalabras.com` (the final/clean build) and shown on every
other host (old builds). For old users to actually receive it, the bare apex must be
pointed at the same Railway service as www. Note: Google Play already shows
"Actualizar" to users on an older version — that native update path works regardless.

## The 3 hosts drift to 3 DIFFERENT builds at once

Because each host has its own pipeline, they can each serve a different build of the
SAME client simultaneously: `stop-el-juego.replit.app` = newest (direct Replit
republish, fully under our control); `www…` = whatever last reached GitHub→Railway;
bare apex = the separate legacy server, usually the oldest. Always verify per host by
`curl`-ing the site and grepping the built JS for marker strings (e.g. `stop_app_version`
for the version-gate build, `www.stopjuegodepalabras.com` for the host-gate build).
The cleanest cure is to consolidate all hosts onto one always-updated origin.

## The installed TWA runs as a Custom Tab → TWA-only detection silently fails

The user's app opens WITH a browser toolbar (X + address bar + share + overflow),
i.e. a Chrome Custom Tab, NOT a verified full-screen TWA. In that mode
`document.referrer === android-app://<pkg>` and the Digital Goods / Play Billing
check are unreliable/absent, so a banner gated only on those signals never appears.
To reach these users the detection must fall back to a broader signal (e.g. Android
UA on the app's non-www domains), or the app must load a host we control.
