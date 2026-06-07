---
name: Player identity & auth model
description: How STOP distinguishes guest vs logged-in players and the rules for server-side identity binding.
---

# Player identity model

Player ids come in two shapes:
- **Guests**: random UUIDs, generated client-side, no provider prefix. The vast
  majority of live traffic. They have no token and must always be allowed.
- **Logged-in**: prefixed with a provider, e.g. `google-...`, `facebook-...`.
  These carry a signed session token in `x-stop-token` (also stored in
  localStorage/sessionStorage as `stop_session_token`).

## Rule: verifyClaimedIdentity(req, claimedId)
- Non-prefixed (guest) ids → pass.
- Provider-prefixed ids → require a valid signed token whose subject matches the
  claimed id; otherwise 403.
- **Fails OPEN when `SESSION_SECRET` is unset.**

**Why:** the game is live with a huge guest base and OAuth users who may not yet
have the client token plumbing. Failing closed (or blocking guests) would break
real players immediately. The binding only tightens once `SESSION_SECRET` is
configured, so it can be rolled out without an outage.

**How to apply:** any new route that mutates a specific player's data (scores,
premium, custom packs, daily submit) should call `verifyClaimedIdentity` and
return 403 on failure — but only AFTER cheap input validation (missing-field
400s come first). Client calls to those routes must attach `authHeaders()` and
`credentials: "include"`.
