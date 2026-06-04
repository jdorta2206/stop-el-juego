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
