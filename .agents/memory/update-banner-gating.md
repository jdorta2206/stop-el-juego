---
name: Update-banner gating (old vs new app)
description: Why the "Actualizar en Google Play" banner must be gated by reported version, never by host.
---

# All APK versions load the SAME website — gate the update banner by version, not host

Every build of the Android app (old and new APK) loads the same web bundle on the
same host (e.g. www.stopjuegodepalabras.com). So the web/client code **cannot tell
which APK version is wrapping it** from anything intrinsic (host, UA, referrer) —
the only signal is what the APK explicitly reports.

**Why this matters:** a previous attempt gated the banner by host
(`if (hostname === "www...") return;`) to keep the "new clean build" free of the
nudge. But since the app loads exactly that host, the gate hid the banner for
EVERY app user → "no sale en ningún móvil." Host-gating is fundamentally wrong here.

**How to apply:**
- Gate the banner ONLY by `isAppUpdateRecommended()` (compare reported version to
  `MIN_RECOMMENDED_APP_VERSION`). Unknown version = old build = show; reported
  version >= threshold = new build = hide.
- The new APK must report its version so it stays clean: launch URL
  `?appVersion=1.3.4.0` (captured by appVersion.ts) or a `STOPApp/<ver>` UA token.
  This is the only way to distinguish old from new. Until the new APK ships that,
  the banner shows on ALL app users (acceptable interim — old users are the target).
- Reliable fallback regardless of all this: Google Play's native "Actualizar"
  prompt, since the new versionName is already published in Play Console.
