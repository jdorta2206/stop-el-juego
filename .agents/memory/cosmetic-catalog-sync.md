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

**Reward-only frames** (earned, never bought) live in a separate server map
`REWARD_FRAMES` (inventoryCatalog.ts), resolved by `resolveCosmetic` but deliberately
absent from `SHOP_ITEMS` so they're unbuyable. Their ids (`frame_collection_*`,
`frame_prestige_*`) STILL must be mirrored in client `FRAME_COLORS_BY_ID`
(PlayerProfile.tsx) or the equipped ring falls back to the level color — same rule as
shop frames, just a different server source map. They are ALSO animated: each id has a
`frame-fx-*` entry in `LEGENDARY_FRAME_FX` (PlayerProfile.tsx) + matching CSS in
index.css (`reward-glow` pulse for most; rotating conic `::before` for the two cumbre
frames `frame_collection_mythic` / `frame_prestige_diamond`). The point of these frames
IS to look special — keep them animated, not flat rings.

**"Leyenda" the leaderboard title** = global rank #1 (derived, not stored). Separately,
the profile **level ladder** ("Nivel") is derived from `gamesPlayed`, and past 200 games
it becomes **infinite prestige**: Leyenda I/II/III…, +1 tier per 100 games, escalating
color + CSS aura. This is duplicated by hand: client `PlayerProfile.tsx`
(getLevel/getNextLevel + PRESTIGE_* consts + `.prestige-aura-N` CSS) and server
`titleCatalog.prestigeTier()` (200 base, +100/tier) — keep both in lockstep.

## Backgrounds ("fondos") — 3rd shop cosmetic kind, stored in inventory_json
A NEW `CosmeticKind "background"` shop category that deliberately has **no DB
column** to avoid a prod migration. Owned ids + the equipped id both live inside
`player_scores.inventory_json` (`backgrounds: string[]` + `equippedBackground`),
parsed/written by `inventory.ts parseInventory`. Buy pushes to `inv.backgrounds`;
equip does an **atomic read-modify-write under `SELECT … FOR UPDATE`** (NOT a plain
update) so a concurrent `/buy` or reward claim can't clobber inventory_json
(lost-update race — required by review). Client mirror: `BACKGROUND_CSS_BY_ID`
(PlayerProfile.tsx) maps id→CSS gradient; same hand-sync rule as avatars/frames.
**Limitation:** the equipped background renders ONLY on the player's OWN profile —
the public profile/ranking payload still only carries avatar/frame/title columns,
so it can't show on others' profiles without also surfacing equippedBackground there.

## Event grouping convention (`_wc_` etc.)
Limited-time event cosmetics use an id substring (first one: `_wc_` for the World
Cup) so the client shop can pull them into their own highlighted section
(PlayerProfile.tsx `isWcItem` filter → "⚽ Especial Mundial" block) while the rest
fall under the normal "Tienda". They're otherwise ordinary coin-buyable SHOP_ITEMS
(avatars incl. flag emojis, frames, backgrounds). Reuse this id-substring pattern
for future events instead of adding a real "event" field.

## Unlockable titles (earned by playing)
A THIRD hand-mirrored catalog, separate from avatars/frames:
- Server = `artifacts/api-server/src/lib/titleCatalog.ts` (`TITLES`, predicates,
  `computeTitleStats`, `evaluateTitles`, `isTitleUnlocked`). GET /api/inventory returns
  the full catalog annotated with `unlocked`; equip route accepts `kind:"title"` and
  validates via `isTitleUnlocked` against LIVE stats (NOT inventory ownership — titles
  are never bought). Profile route returns `equippedTitle`.
- Client = `TITLE_META_BY_ID` in `PlayerProfile.tsx` (id → label/icon/color) to render
  the equipped pill on ANY profile; `desc`/`unlocked` come from the server payload.
  Keep ids/labels/icons/colors in sync with the server list.

**Integrity rule — title unlock predicates must read ONLY server-authoritative counters**
(`games_played`, `wins`, `current_streak`, `longest_streak`, `total_score`, derived
`prestige`). **Why:** `achievements_json` and `collected_words_json` are client-merged via
POST /ranking/progress (never-remove merge), so basing an "earned by playing" unlock on
them lets a crafted request self-award the title. Original drafts used collectedWords/
achievementCount and were re-based onto totalScore/wins for exactly this reason.
