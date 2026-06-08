// ── Tienda rotatoria diaria (daily deals) ──────────────────────────────────
// Adds a "vuelvo mañana a ver qué hay" loop WITHOUT removing any long-term
// goal: every shop item is still buyable at full price all the time. What
// rotates is a small set of DISCOUNTED deals, chosen deterministically from
// the UTC date so the server and every client agree without any DB state.
//
// Security: the buy route re-derives today's price server-side (dealPriceFor)
// and never trusts a price sent by the client.

import { SHOP_ITEMS } from "./inventoryCatalog";

export interface DailyDeal {
  id: string;
  /** Full catalog price. */
  originalPrice: number;
  /** Discounted price the player actually pays today. */
  price: number;
  /** Whole-percent discount (e.g. 25). */
  discountPct: number;
}

const DEAL_COUNT = 3;
const DISCOUNTS = [15, 20, 25, 30]; // possible whole-percent discounts

/** UTC date key, e.g. "2026-06-08". Deals reset at 00:00 UTC. */
function dateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Epoch ms of the next 00:00 UTC after `now` (when deals refresh). */
export function dealsResetAt(now: Date = new Date()): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return next.getTime();
}

// Tiny deterministic hash → seeded RNG. Same date ⇒ same deals everywhere.
function xfnv1a(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic pick of DEAL_COUNT distinct shop items + a discount each. */
export function getDailyDeals(now: Date = new Date()): { deals: DailyDeal[]; resetAt: number } {
  const key = dateKey(now);
  const rand = mulberry32(xfnv1a(`stop-daily-shop:${key}`));

  // Fisher–Yates shuffle of indices, seeded by the day.
  const idx = SHOP_ITEMS.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }

  const deals: DailyDeal[] = [];
  for (let k = 0; k < Math.min(DEAL_COUNT, idx.length); k++) {
    const item = SHOP_ITEMS[idx[k]];
    const discountPct = DISCOUNTS[Math.floor(rand() * DISCOUNTS.length)];
    const price = Math.max(1, Math.round((item.price * (100 - discountPct)) / 100));
    deals.push({ id: item.id, originalPrice: item.price, price, discountPct });
  }
  return { deals, resetAt: dealsResetAt(now) };
}

/** Today's effective price for an item: deal price if on offer, else null. */
export function dealPriceFor(itemId: string, now: Date = new Date()): number | null {
  const { deals } = getDailyDeals(now);
  const deal = deals.find((d) => d.id === itemId);
  return deal ? deal.price : null;
}
