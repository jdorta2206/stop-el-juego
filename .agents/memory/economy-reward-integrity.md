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

## Retention nudge
A daily-deals push ("🏷️ ¡Nuevas ofertas hoy!") is sent once/player/day at ~10:00
their LOCAL time from `dailyCron.ts`, reusing the Happy-Hour per-tz window +
bucket lock pattern. Body advertises today's real max discount; deep-links to the
player's own profile with the shop section anchored/scrolled into view.
**Why:** deals reset 00:00 UTC and are invisible unless the player opens the app — the
push is what closes the renewable loop, and a deep-link straight to the shop converts
better than dropping them at the profile top. Any new daily nudge should copy this
tz-bucket pattern, NOT a fixed-UTC blast (which hits everyone at a bad local hour).

## Frontend mirrors of server cosmetic/title catalogs MUST stay in sync
Titles, reward-frame names, and frame colors each have a server source of truth and a
hand-maintained frontend mirror. Adding/renaming an entry server-side without updating
its mirror causes a silent UI gap (e.g. a blank equipped-title pill, or a generic
"marco exclusivo" instead of the real frame name).
**Why:** there is no build-time parity check — drift is only caught by eyeballing the UI.
**How to apply:** when you touch a title or reward-frame entry on the server, grep the
stop-game side for the matching mirror and update it in the same change.

## Prestige titles are economic-safe
Prestige-gated titles unlock off the prestige tier (derived from server-authoritative
games_played), so they're forge-proof like every other title predicate, and their tiers
intentionally line up with the milestone reward frames so reaching a frame tier also
grants a matching title. **Why:** keeps "earned by playing" honest and the two reward
ladders feel coherent rather than arbitrary.

## Claim/buy invariants (all reward + buy POST routes)
Every coin-granting or coin-spending mutation MUST: run in a `db.transaction`, lock
the player row with `SELECT ... FOR UPDATE`, re-check eligibility/ownership/claimed
state *inside* the lock, and write the reward + the claim/ownership guard in the SAME
update. Double-claim guards are append-only id arrays: `prestige_claims_json` (tiers)
and `collection_claims_json` (set ids). This is the established double-spend pattern —
follow it for any future renewable reward.
