---
name: Cosmetic catalog client/server sync
description: Cosmetics (avatars, frames, prices, visuals) are duplicated across server and client by hand — adding one requires editing both sides or visuals silently break.
---

# Cosmetic catalog is duplicated client ↔ server

The cosmetic catalog (avatars, frames, prices, colors, animation FX) has **no single
source of truth**. It is maintained by hand in two places that must agree:

- **Server** = the authoritative catalog (IDs, `label`, `glyph`, `color`, `price`,
  and `resolveCosmetic`/`SHOP_ITEMS` lookup). Buy/equip validate against this.
- **Client** = a manual mirror used only for *visuals* (frame ring color, avatar
  glyph emoji, and any animation class). The server never sends the visual class.

**Why:** the server comment explicitly says "nothing on the server side needs the
visuals" — so the frontend re-declares color/glyph/FX keyed by the same IDs.

**How to apply:** when adding ANY new cosmetic, edit BOTH sides or it half-works:
- New avatar → server catalog **and** the client avatar-glyph map, or it shows the
  player's initial instead of the emoji.
- New frame → server catalog **and** the client frame-color map, or the equipped
  ring falls back to the level color. Animated/"legendary" frames additionally need
  a client FX class map entry **and** matching CSS `@keyframes`, or the ring is static.

The buy/equip routes are **price-agnostic and atomic** (row-locked tx), so high-cost
coin-sink items need NO backend logic change — only a catalog entry with the price.

**"Leyenda" is NOT a level** — it's global leaderboard rank #1 (a derived title, not
stored). True per-player "infinite prestige" must be built on XP levels (everyone can
climb), not on the rank title (only one player holds it).
