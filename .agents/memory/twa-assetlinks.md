---
name: TWA full-screen / assetlinks fingerprint
description: Why the Android TWA suddenly shows the browser address bar and how to fix it.
---

# TWA shows browser toolbar (not full-screen)

The Play Store app is a TWA (`app.replit.stop_el_juego.twa`) whose launch URL is
the www domain (Railway-served). For it to run full-screen WITHOUT the browser
address bar, the domain must serve `/.well-known/assetlinks.json` whose
`sha256_cert_fingerprints` includes the certificate that signed the installed APK.

**Symptom:** app opens with the Chrome address bar visible ("como una web")
instead of full-screen. = Digital Asset Links verification failed = fingerprint
mismatch.

**Rule:** the served assetlinks.json must contain the **Google Play App Signing**
SHA-256 fingerprint (from Play Console → Setup → App integrity). When in doubt,
list MULTIPLE fingerprints in the array (upload key + Play signing key) — Android
passes if ANY entry matches, so extra entries are harmless and robust.

**Why this bit us:** the served file had only one fingerprint (`4F:62:…`) but the
Play-signed app used `30:B6:…` (the value the user kept pasting from Play Console).
Fixed by listing both in the array.

**Deploy note:** the file lives at `artifacts/stop-game/public/.well-known/assetlinks.json`,
copied to dist on build, and served by api-server's explicit
`/.well-known/assetlinks.json` route (express.static skips dotfile dirs). Changes
only reach the TWA after the **www domain** is redeployed (wherever its DNS
points — Replit deploy and/or the GitHub→Railway push).

## Deploy mechanism (confirmed)
- www = Railway, auto-deploys from GitHub repo `jdorta2206/stop-el-juego` (branch
  `master`, public). Replit checkpoints reach that repo, and Railway rebuilds
  automatically — the both-fingerprints fix appeared on GitHub master and went
  live on www without a manual push.
- After the server serves the correct assetlinks, the **phone still caches** the
  old Digital Asset Links verification: user must fully close+reopen the TWA, and
  if the address bar persists, clear the app's cache once
  (Settings → Apps → STOP → Storage → Clear cache).
