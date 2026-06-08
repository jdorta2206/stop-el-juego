---
name: Score voucher anti-cheat (Solo & Daily)
description: How forged leaderboard/daily scores are clamped via signed round vouchers, and the invariants that keep vouchers un-farmable.
---

# Score vouchers: clamp, never reject

Solo & Daily submissions used to trust the client's posted `score` (and thus the
coins/XP derived from it). Now `/game/validate` — which already computes the
authoritative per-round base — hands back a **signed single-use HMAC voucher**
attesting that base. The client collects one voucher per round and returns them
on submit. The submit endpoints **clamp** (never reject) the posted score to a
ceiling derived from the verified base, so fabricated totals get cut while legit
client-side modifier bonuses (steal/sabotage/bluff/FTUE) still pass.

- Ceiling = `verified>0 ? base*4+50 : absoluteCeiling(mode)`. The ×4 headroom is
  deliberate — it must cover stacked modifiers so a real game is never clamped.
- Tokenless submissions (offline/legacy client) fall back to a flat per-mode
  absolute ceiling. **Why clamp not reject:** offline play and modifier bonuses
  are legitimate; rejecting would lose real scores.

## The non-obvious invariant: cap counted vouchers per mode
A voucher is cheap to mint (one `/validate` call), so a script can stockpile
thousands and **pool** them to inflate one submission. The fix is NOT player/game
binding (the generated client doesn't send a player id on `/validate`, and there
is no game-session lifecycle). Instead:

- `sumVerifiedBase(tokens, maxTokens)` counts only the **top-N vouchers by base**,
  N = the submitting mode's max rounds (solo 3, daily 1). Pooling extra vouchers
  can never raise the ceiling beyond a legit game.
- **Every** valid voucher in the batch is burned (jti marked used), even the
  surplus beyond the cap, so leftovers can't be replayed in a later submission.
- **Why:** without the per-mode count cap, summing unbounded valid bases lets a
  farmer raise the ceiling arbitrarily — the signature check alone is not enough.

## Known residual (accepted, out of scope)
- Daily + leaderboard both fire on game end with the SAME single-use voucher
  array; whichever lands first consumes them, the other falls to the absolute
  ceiling. Accepted.
- `bonus:true` submissions add the *clamped* score again (coins are 0 via
  `calcCoinGain` for bonus, so no coin double-dip). Repeat-bonus inflation is a
  pre-existing vector bounded by the clamp + rate limiter; closing it fully needs
  a one-time server-issued bonus proof.

## Requires SESSION_SECRET
Vouchers sign with `SESSION_SECRET` (≥16 chars). If missing, issuance is disabled
and every submission falls back to the absolute ceiling — so the prod host MUST
have `SESSION_SECRET` set or legit high scores get clamped low.
