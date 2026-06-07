---
name: Profile modal & logout flow (stop-game)
description: Why the header profile modal once crashed the error boundary, and how logout must clear the httpOnly cookie cross-origin.
---

# Profile modal must use the real `Modal` from `components/ui`

The header name/avatar chip opens a profile modal (edit name/color + logout).
A regression once shipped where this modal referenced a `<Modal>` component
that was never defined/imported and i18n keys `t.profile.*` / `t.common.*`
that exist in NO language file. Result: opening the profile (the only path
to logout) threw at render and tripped the error boundary
("¡Algo salió mal!"). The error boundary only catches RENDER errors, so this
looked like a "logout crash" but was really a profile-modal render crash.

**Why:** esbuild/vite does NOT fail the build on undefined identifiers or
missing object keys — they only blow up at runtime. So `pnpm tsc --noEmit`
is the only thing that surfaces them. Always run it after touching shared UI.

**How to apply:** `Modal` lives in `stop-game/src/components/ui.tsx`. This
file's i18n convention is inline `lang === "en" ? ... : ...` ternaries
(es/en/pt/fr) for one-off strings, plus shared keys under `t.nav.*`. There is
NO `t.profile` or `t.common` namespace — don't reference them.

# Logout must clear the httpOnly cookie on every relevant origin, then reload

The session cookie (`stop_pt`, httpOnly, sameSite=none, secure) can only be
cleared server-side. Logout best-effort POSTs `/api/auth/logout` (keepalive,
credentials:include) to current origin + configured API origin + canonical
(`stop-el-juego.replit.app`, where the TWA cross-domain cookie lives), wipes
local profile/session-token/dismissed flag, then HARD-REDIRECTS to BASE_URL.

**Why:** mutating player→null in place tears the player out from under mounted
player-dependent pages (Room/SoloGame/Tournament/DailyChallenge read
`player.*` at render) → crash. A reload lands in the known-good cold-start
view. Logged-in users hit the `if (stored)` branch (no network) so they
render instantly; only no-localStorage visitors see the restore spinner.
