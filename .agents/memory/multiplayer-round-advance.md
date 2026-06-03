---
name: Multiplayer round advance must not depend on inbound POST
description: Why STOP-game rounds need a background failsafe sweeper, and the rules for round-end side effects
---

# Multiplayer round advance (STOP game, rooms.ts)

A multiplayer round advances only when every player `isReady`. Historically that
check ran ONLY inside the `POST /:roomCode/results` handler. That deadlocks the
whole table if the LAST pending player's POST never reaches the server (their SSE
stays "online" so the in-handler presence/grace sweep never zeroes them, and no
other player is left to trigger advancement). Symptom: room stuck on "Esperando a
los demás jugadores" with one player frozen on "Enviando…", forever.

**Two distinct round-end paths — a fix must cover BOTH:**
- **STOP pressed** → `/stop` sets `status="stopped"` + `stopperJson.stopTimestamp`.
- **Timer expired, no STOP** → clients `autoSubmit` to `/results`, but room stays
  `status="playing"` with only `roundStartedAt` (NO stopTimestamp). This path also
  deadlocks if a POST is lost.

**Rule:** round advancement must have a server-side failsafe independent of any
inbound request. `sweepStuckRooms()` runs on a `setInterval` (guarded against tsx
hot-reload via a `globalThis` key, same pattern as the purge timer) and scans BOTH
`"stopped"` and `"playing"` rooms. The round-end instant is `roundEndTimestamp()` =
explicit stopTimestamp, else `roundStartedAt + roundDurationSecs*1000`. Only act
once `now - endTs > SUBMIT_GRACE_MS` (fresh/in-progress rounds have endTs in the
future, so they're skipped).

**Why side effects must run only AFTER the optimistic write wins:**
The sweep+advance computation (`finalizeRoundState`) is shared by the handler and
the sweeper, so two writers can race the same round. Both guard on `updatedAt`
(optimistic concurrency) so only one DB write wins. Therefore one-shot side
effects — `submitAllScoresToLeaderboard` (NOT idempotent) and spy/live map cleanup
— must NOT live inside `finalizeRoundState`; they run in the caller via
`applyRoundAdvanceSideEffects()` ONLY after `updateResult.length > 0`. Putting them
in the shared computation double-submits the leaderboard when the loser also ran them.

**How to apply:** any future change to round advancement (new phases, scoring,
bluff flow) must keep `finalizeRoundState` pure (state only) and keep the failsafe
sweeper covering every status that can hold a mid-round. Client recovery needs no
change: `Room.tsx` effect on `[roomStatus, currentRound]` pulls a frozen player out
of local `phase="submitted"` when SSE/poll reports waiting/finished/bluffvoting.
