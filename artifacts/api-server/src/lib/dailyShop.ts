// Daily + weekly rotating shop helpers.
// Daily deals reset at 00:00 UTC. The weekly storefront resets Monday 00:00 UTC.
// Prices are always re-derived server-side; the client never controls price.

import { SHOP_ITEMS, type ShopItem } from "./inventoryCatalog";

export interface DailyDeal {
  id: string;
  originalPrice: number;
  price: number;
  discountPct: number;
}

export interface WeeklyDeal extends DailyDeal {}

export interface WeeklyShop {
  items: ShopItem[];
  deals: WeeklyDeal[];
  resetAt: number;
  weekKey: string;
}

const DEAL_COUNT = 3;
const WEEKLY_ITEM_COUNT = 12;
const DISCOUNTS = [15, 20, 25, 30];
const WC_MARKER = "_wc_";
const HALLOWEEN_MARKER = "_halloween_";

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

function shuffled<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(xfnv1a(seed));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function dateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function dealsResetAt(now: Date = new Date()): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.getTime();
}

/** Legacy daily offers kept for the existing cron and any callers. */
export function getDailyDeals(now: Date = new Date()): { deals: DailyDeal[]; resetAt: number } {
  const key = dateKey(now);
  const rand = mulberry32(xfnv1a("stop-daily-shop:" + key));
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

function mondayStart(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d;
}

function weeklyKey(now: Date): string {
  return mondayStart(now).toISOString().slice(0, 10);
}

export function shopResetAt(now: Date = new Date()): number {
  const next = mondayStart(now);
  next.setUTCDate(next.getUTCDate() + 7);
  return next.getTime();
}

function availableWeeklyItems(): ShopItem[] {
  return SHOP_ITEMS.filter((item) => !item.id.includes(WC_MARKER) && !item.id.includes(HALLOWEEN_MARKER));
}

function selectWithoutPrevious(key: string): ShopItem[] {
  const available = availableWeeklyItems();
  const avatars = shuffled(available.filter((i) => i.kind === "avatar"), "stop-weekly:" + key + ":avatar").slice(0, 5);
  const frames = shuffled(available.filter((i) => i.kind === "frame"), "stop-weekly:" + key + ":frame").slice(0, 4);
  const backgrounds = shuffled(available.filter((i) => i.kind === "background"), "stop-weekly:" + key + ":background").slice(0, 3);
  return shuffled([...avatars, ...frames, ...backgrounds].slice(0, WEEKLY_ITEM_COUNT), "stop-weekly:" + key + ":display");
}

function selectWeeklyItems(key: string): ShopItem[] {
  const available = availableWeeklyItems();
  const previousDate = new Date(key + "T00:00:00.000Z");
  previousDate.setUTCDate(previousDate.getUTCDate() - 7);
  const previousKey = previousDate.toISOString().slice(0, 10);
  const previous = new Set(selectWithoutPrevious(previousKey).map((i) => i.id));
  const fresh = available.filter((i) => !previous.has(i.id));
  const pool = fresh.length >= WEEKLY_ITEM_COUNT ? fresh : available;

  const picked = [
    ...shuffled(pool.filter((i) => i.kind === "avatar"), "stop-weekly:" + key + ":avatar").slice(0, 5),
    ...shuffled(pool.filter((i) => i.kind === "frame"), "stop-weekly:" + key + ":frame").slice(0, 4),
    ...shuffled(pool.filter((i) => i.kind === "background"), "stop-weekly:" + key + ":background").slice(0, 3),
  ];
  const selected = new Set(picked.map((i) => i.id));
  if (picked.length < WEEKLY_ITEM_COUNT) {
    for (const item of shuffled(pool, "stop-weekly:" + key + ":fill")) {
      if (!selected.has(item.id)) {
        picked.push(item);
        selected.add(item.id);
      }
      if (picked.length >= WEEKLY_ITEM_COUNT) break;
    }
  }
  return shuffled(picked.slice(0, WEEKLY_ITEM_COUNT), "stop-weekly:" + key + ":display");
}

export function getWeeklyShop(now: Date = new Date()): WeeklyShop {
  const key = weeklyKey(now);
  const items = selectWeeklyItems(key);
  const selectedDeals = shuffled(items, "stop-weekly-deals:" + key).slice(0, Math.min(DEAL_COUNT, items.length));
  const deals = selectedDeals.map((item, index) => {
    const discountPct = DISCOUNTS[xfnv1a(key + ":deal:" + index) % DISCOUNTS.length];
    return {
      id: item.id,
      originalPrice: item.price,
      price: Math.max(1, Math.round((item.price * (100 - discountPct)) / 100)),
      discountPct,
    };
  });
  return { items, deals, resetAt: shopResetAt(now), weekKey: key };
}

/** Effective price for the current weekly storefront, or null if not discounted. */
export function dealPriceFor(itemId: string, now: Date = new Date()): number | null {
  const weekly = getWeeklyShop(now).deals.find((deal) => deal.id === itemId);
  if (weekly) return weekly.price;
  // Keep legacy callers safe: an item can still have a daily offer outside the weekly deals.
  return getDailyDeals(now).deals.find((deal) => deal.id === itemId)?.price ?? null;
}

export function isWeeklyShopItem(itemId: string, now: Date = new Date()): boolean {
  return getWeeklyShop(now).items.some((item) => item.id === itemId);
}
