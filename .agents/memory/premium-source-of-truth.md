---
name: Premium entitlement single source of truth
description: Server premium gating must use isUserPremium(), never the raw is_premium column
---

# Premium: one source of truth = isUserPremium()

The client UI (`usePremium`) decides premium from the **live unified
entitlement**: `/api/billing/play/status` → `isUserPremium()` (Stripe web sub
OR active Google Play sub), and it self-heals `player_scores.is_premium`.

The `player_scores.is_premium` column is a **cached mirror** that can lag a
live subscription (e.g. a Play purchase whose /verify self-heal hasn't run, or
a Stripe sub that became active out-of-band). 

**Rule:** any server action that *gates* a premium-only feature, or pays a
premium bonus, must resolve entitlement via `isUserPremium(playerId)` (in
`api-server/src/lib/premiumStatus.ts`) — NOT by reading the raw
`player_scores.is_premium` column. Reading the raw column caused paying users
to get 403 "Premium subscription required" on Season Pass claims while the UI
showed "Suscripción activa".

**Why:** the UI and the gate must share the same truth or a paying user hits a
dead button / 403 (a money + trust bug).

**How to apply:**
- Call `isUserPremium(playerId)` for the decision; best-effort self-heal the
  column afterward via `stripeStorage.updatePlayerStripeInfo(playerId, { isPremium })`.
- `isUserPremium` does external billing lookups — resolve it BEFORE opening a DB
  transaction so you never hold a row lock (e.g. `SELECT ... FOR UPDATE`) during
  the network call.
- Known remaining raw-column readers to migrate if they ever gate a user action:
  `routes/rooms.ts` (multiplayer host/joiner premium). Currently tolerable
  because opening the app self-heals the column, but prefer `isUserPremium`.
