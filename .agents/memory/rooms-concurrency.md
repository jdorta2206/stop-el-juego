---
name: Rooms concurrency invariants
description: Race-condition rules for multiplayer room state mutations in api-server rooms.ts.
---

# Rooms concurrency

Room state lives in a single `playersJson` blob + status column. Multiple clients
(and the stale-room sweeper) can write concurrently, so read-modify-write must be
guarded.

## Invariants
- **Bluff scoring**: resolving bluffs (vote handler, `/resolve-bluffs`, and the
  sweeper) must CAS on `status = 'bluffvoting'` and submit leaderboard scores
  ONLY if the transition write returned a row. Submit AFTER the write, never
  before. This prevents the same round being scored twice.
- **use-card**: optimistic-concurrency loop — re-read fresh state, CAS on
  `updatedAt`, retry up to 5x, else 409. Prevents a concurrent `/results` write
  from clobbering the card effect and prevents double-apply on double-click.

**Why:** earlier bugs double-counted scores and lost answers when two writes
interleaved. The CAS-on-state pattern makes exactly one writer win.

**How to apply:** for any new room mutation that depends on current state, gate
the UPDATE with a WHERE that includes the state you read (status and/or
updatedAt), and treat an empty `.returning()` as "lost the race" — retry or
no-op, never assume success.
