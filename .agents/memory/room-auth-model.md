---
name: STOP multiplayer identity / room-route auth model
description: Why room routes intentionally do NOT enforce requirePlayerIdentity, and why a server-only impersonation fix is impossible.
---

# Multiplayer identity is guest-first

- **Guests** (the majority): the client generates `crypto.randomUUID()` and stores
  the profile in `localStorage` (`stop_player_v2`). They have **NO signed token**.
- **Logged-in (OAuth)** users get a signed `stop_session_token` (HMAC over
  `playerId.exp`, see `lib/playerAuth.ts` `issuePlayerToken`), set as cookie
  `stop_pt` (sameSite=none, secure) and mirrored to localStorage.
- The client sends the actor's `playerId`/`hostId` in the **request body/query**
  on room calls, and does **NOT** consistently send `x-stop-token` or
  `credentials:include` on those calls (only `/auth/me` restore does).
- The client **relies on `GET /rooms/:code` returning every player's `playerId`**
  to render the scoreboard/players — but ONLY MEMBERS now get that full payload
  (see the private-room gate below). Members prove identity so rendering still
  works; non-members of private rooms get a sanitized preview.

## Private-room GET is membership-gated (info-leak + impersonation mitigation)
`GET /rooms/:code` used to return the full roster (every id/name/score/in-round
answers + hostId) to ANYONE who knew the code. Now, for PRIVATE rooms
(`isPublic !== true`), only members get the full payload; non-members get
`sanitizedRoomPreview` (status/counts only, `players: []`, `hostId: null`,
`restricted: true`). Public/streamer rooms are unchanged (spectatable by design).
Membership identity is resolved as:
- a cryptographically verified token (`readPlayerId`) — always trusted; OR
- a SELF-ASSERTED id (`?viewerId=` or `x-viewer-id` header) — trusted ONLY when
  it is a GUEST id. A logged-in (`provider_`) id must NOT be self-assertable.
**Why the guest/logged-in split:** logged-in ids are PUBLIC (e.g. leaderboard),
so trusting an unverified logged-in assertion re-opens the leak for any private
room containing a known account. Guest ids aren't discoverable once this gate
hides the roster, so a guest's own id acts as a weak bearer secret.
**How callers prove membership:** `Room.tsx` poller passes `x-viewer-id` via the
generated client's `request.headers` (no codegen needed); the `Multiplayer.tsx`
resume probe passes `?viewerId=`; logged-in users are covered by the global
`x-stop-token` in `custom-fetch`. Any NEW `GET /rooms/:code` caller for a member
context MUST send one of these or it gets the sanitized preview.

## This is also the realistic guest-impersonation mitigation
There is still NO robust server-only guest-impersonation fix. But this gate
removes the PRIMARY vector: a stranger previously learned a member's id straight
from this response, then replayed it. With the roster hidden, the main
id-discovery path is closed. Residual risk is intra-room among invited members —
accept it, or require login for sensitive actions; do NOT fake a deeper fix.

## Rule: do NOT blanket-enforce auth on room routes
`requirePlayerIdentity` exists but is intentionally unused in `routes/rooms.ts`.

**Why:** enforcing it would 401 every guest (no token) and most logged-in players
(client doesn't send the token on room calls). Sanitizing `playerId`s out of
`GET /rooms` would break client rendering. Either change breaks the LIVE game.

**How to apply:** A real impersonation fix is impossible server-only — guests have
no credential to verify. *Opportunistic* binding ("verify token only if present")
is no-breakage but also no-benefit (an attacker just omits the token).
*Effective* binding ("require a matching token when the room host is a logged-in
id") risks locking out legit logged-in hosts on any client path that doesn't send
the token (several `Room.tsx` calls are hand-written fetches that don't). A proper
fix needs coordinated client+server identity work AND multiplayer E2E testing —
never push it blind to production.
