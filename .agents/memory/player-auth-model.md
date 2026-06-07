---
name: Player identity & auth model
description: How STOP distinguishes guest vs logged-in players and the rules for server-side identity binding.
---

# Player identity model

Player ids come in two shapes:
- **Guests**: random UUIDs, generated client-side, no provider prefix. The vast
  majority of live traffic. They have no token and must always be allowed.
- **Logged-in**: prefixed with a provider using an UNDERSCORE, e.g. `google_`,
  `fb_`, `ig_`, `apple_`, `tt_` (NOT hyphens — audits get this wrong).
  These carry a signed session token in `x-stop-token` (also stored in
  localStorage/sessionStorage as `stop_session_token`). Token TTL is 1 YEAR, so
  no mid-game expiry risk.

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
premium, custom packs, daily submit, room actions, ranking/progress) should call
`verifyClaimedIdentity` and return 403 on failure — but only AFTER cheap input
validation (missing-field 400s come first). Client calls to those routes must
attach `authHeaders()` and `credentials: "include"`.

## Pitfall: guarding a route means finding EVERY client caller
When you add a guard, the same endpoint is often called from several places, not
just the obvious page. Grep the whole client for the path before finishing.
Known caller hotspots beyond the obvious page component:
- `rooms/:code/join` is called from BOTH the generated client AND
  `components/ChallengeNotification.tsx` (invite/challenge accept) — the latter
  is hand-written `fetch` and is easy to miss.
- `ranking/progress/:playerId` POST is called from hooks
  `usePersonalBest`, `useAchievements`, `useCollection` (sync-to-server). Its
  GET is unguarded, so only the POSTs need `authHeaders()`.
A missed caller = legit logged-in users get 403 once `SESSION_SECRET` is set.

## Endpoints intentionally left UNGUARDED
- `rooms/:code/leave` — fired via `navigator.sendBeacon` on unload, which cannot
  set custom headers; guarding it would 403 legit logged-in users. Low risk.
- `resolve-bluffs` and cosmetic high-frequency endpoints (react/typing/spy/
  funvote/phrase/category-pack) carry no player-data-mutating identity.
