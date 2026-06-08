---
name: Self-renewing economy reward integrity
description: Which coin payouts are forge-safe vs not, and the claim/shop invariants that keep the renewable economy (daily shop, collection sets, prestige) un-exploitable.
---

# Renewable economy: what's forge-safe and what isn't

Three self-renewing systems feed the coin economy. The integrity line is **what
backs each payout**:

- **Prestige (Leyenda) milestone rewards** → coins scale with prestige tier, derived
  from `games_played`. `games_played` is server-authoritative (incremented atomically
  on round submit), so these payouts are SAFE to be large. Eligibility recomputed at
  claim from `prestigeTier(games_played)`.
- **Collection-set rewards** → derived from `collected_words_json`, which is
  **client-merged** via POST /ranking/progress (never-remove merge). That makes the
  word counts forgeable, so collection coin amounts are kept **moderate + one-time**;
  the *headline* reward is an **exclusive unbuyable frame**, not coins.
  **Why:** same reasoning as the title-unlock integrity rule — never base a large coin
  payout on client-merged progress.
- **Daily shop deals** → discounted prices chosen deterministically from the **UTC
  date** (seeded RNG, no DB). Server re-derives today's price on buy (`dealPriceFor`)
  and never trusts a client price. Deals reset 00:00 UTC.

## Claim/buy invariants (all reward + buy POST routes)
Every coin-granting or coin-spending mutation MUST: run in a `db.transaction`, lock
the player row with `SELECT ... FOR UPDATE`, re-check eligibility/ownership/claimed
state *inside* the lock, and write the reward + the claim/ownership guard in the SAME
update. Double-claim guards are append-only id arrays: `prestige_claims_json` (tiers)
and `collection_claims_json` (set ids). This is the established double-spend pattern —
follow it for any future renewable reward.
