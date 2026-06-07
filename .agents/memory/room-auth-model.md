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
  to render the scoreboard/players.

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
