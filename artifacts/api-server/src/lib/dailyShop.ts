// Tienda rotatoria semanal.
// Cada semana se selecciona automáticamente un escaparate nuevo del catálogo.
// La selección es determinista, no necesita una tabla ni una tarea manual y
// cambia cada lunes a las 00:00 UTC. Los productos comprados nunca se pierden.

import { SHOP_ITEMS, type ShopItem } from "./inventoryCatalog";

export interface WeeklyDeal {
  id: string;
  originalPrice: number;
  price: number;
  discountPct: number;
}

export interface WeeklyShop {
  items: ShopItem[];
  deals: WeeklyDeal[];
  resetAt: number;
  weekKey: string;
}

const WEEKLY_ITEM_COUNT = 12;
const DEAL_COUNT = 3;
const DISCOUNTS = [15, 20, 25, 30];
const WC_MARKER = "_wc_";

function mondayStart(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

function weekKey(now: Date): string {
  return mondayStart(now).toISOString().slice(0, 10);
}

export function shopResetAt(now: Date = new Date()): number {
  const next = mondayStart(now);
  next.setUTCDate(next.getUTCDate() + 7);
  return next.getTime();
}

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

function shuffled(items: ShopItem[], seed: string): ShopItem[] {
  const rand = mulberry32(xfnv1a(seed));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function selectWeeklyItems(key: string): ShopItem[] {
  const available = SHOP_ITEMS.filter((item) => !item.id.includes(WC_MARKER));
  const currentStart = new Date(key + "T00:00:00.000Z");
  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - 7);
  const previousKey = previousStart.toISOString().slice(0, 10);
  const previous = new Set(selectWithoutPrevious(previousKey).map((item) => item.id));
  const fresh = available.filter((item) => !previous.has(item.id));
  const pool = fresh.length >= WEEKLY_ITEM_COUNT ? fresh : available;

  const byKind = {
    avatar: shuffled(pool.filter((item) => item.kind === "avatar"), "stop-weekly:" + key + ":avatar"),
    frame: shuffled(pool.filter((item) => item.kind === "frame"), "stop-weekly:" + key + ":frame"),
    background: shuffled(pool.filter((item) => item.kind === "background"), "stop-weekly:" + key + ":background"),
  };

  const picked = [
    ...byKind.avatar.slice(0, 5),
    ...byKind.frame.slice(0, 4),
    ...byKind.background.slice(0, 3),
  ];

  if (picked.length < WEEKLY_ITEM_COUNT) {
    const selected = new Set(picked.map((item) => item.id));
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

function selectWithoutPrevious(key: string): ShopItem[] {
  const available = SHOP_ITEMS.filter((item) => !item.id.includes(WC_MARKER));
  const byKind = {
    avatar: shuffled(available.filter((item) => item.kind === "avatar"), "stop-weekly:" + key + ":avatar"),
    frame: shuffled(available.filter((item) => item.kind === "frame"), "stop-weekly:" + key + ":frame"),
    background: shuffled(available.filter((item) => item.kind === "background"), "stop-weekly:" + key + ":background"),
  };
  const picked = [
    ...byKind.avatar.slice(0, 5),
    ...byKind.frame.slice(0, 4),
    ...byKind.background.slice(0, 3),
  ];
  return shuffled(picked.slice(0, WEEKLY_ITEM_COUNT), "stop-weekly:" + key + ":display");
}

export function getWeeklyShop(now: Date = new Date()): WeeklyShop {
  const key = weekKey(now);
  const items = selectWeeklyItems(key);
  const rand = mulberry32(xfnv1a("stop-weekly-deals:" + key));
  const deals: WeeklyDeal[] = [];
  for (const item of shuffled(items, "stop-weekly-deals-pick:" + key).slice(0, Math.min(DEAL_COUNT, items.length))) {
    const discountPct = DISCOUNTS[Math.floor(rand() * DISCOUNTS.length)];
    const price = Math.max(1, Math.round((item.price * (100 - discountPct)) / 100));
    deals.push({ id: item.id, originalPrice: item.price, price, discountPct });
  }
  return { items, deals, resetAt: shopResetAt(now), weekKey: key };
}

export function dealPriceFor(itemId: string, now: Date = new Date()): number | null {
  return getWeeklyShop(now).deals.find((deal) => deal.id === itemId)?.price ?? null;
}

export function isWeeklyShopItem(itemId: string, now: Date = new Date()): boolean {
  return getWeeklyShop(now).items.some((item) => item.id === itemId);
}
