// ============================================================
// playBilling.ts - Google Play Billing wrapper (frontend)
// ============================================================

const PREMIUM_SKU = "premium_monthly";
const WORLD_CUP_SKU = "pack_mundial";

export function isPlayBillingAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.getDigitalGoodsService === "function";
}

export function hasGooglePlayBillingApi(): boolean {
  return isPlayBillingAvailable();
}

export function hasAndroidAppReferrer(): boolean {
  if (typeof document === "undefined") return false;
  return document.referrer?.startsWith("android-app://") ?? false;
}

export function hasPlayTwaMarker(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.search.includes("source=googleplay-twa");
}

export function hasTwaVersionSignal(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  try {
    const appVersion = new URLSearchParams(window.location.search).get("appVersion");
    if (appVersion) return true;
  } catch {}
  return /STOPApp\/[0-9][0-9.]*/i.test(navigator.userAgent || "");
}

export function isLikelyPlayTwa(): boolean {
  if (hasPlayTwaMarker()) return true;
  if (hasTwaVersionSignal()) return true;
  if (hasGooglePlayBillingApi()) return true;
  if (hasAndroidAppReferrer()) return true;
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  return isAndroid && isStandalone;
}

export async function fetchPlayProduct(): Promise<PlayProduct | null> {
  if (typeof window === "undefined" || !window.getDigitalGoodsService) return null;
  try {
    const service = await window.getDigitalGoodsService("https://play.google.com/billing");
    const details = await service.getDetails([PREMIUM_SKU]);
    if (details && details.length > 0) {
      const product = details[0] as any;
      return { id: product.productId ?? product.itemId, title: product.title, priceLabel: product.price };
    }
    return null;
  } catch {
    return null;
  }
}

export async function purchasePremiumOnPlay(playerId: string): Promise<{ isPremium: boolean }> {
  if (!isPlayBillingAvailable()) throw new Error("Google Play Billing no está disponible en este entorno");
  const service = await window.getDigitalGoodsService("https://play.google.com/billing");
  const { responseCode, purchaseData } = await (service as any).purchase(PREMIUM_SKU);
  if (responseCode !== 0) {
    if (responseCode === 5) throw new Error("PURCHASE_CANCELLED");
    throw new Error(`Error en la compra: código ${responseCode}`);
  }
  const res = await fetch("/api/billing/play/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, productId: PREMIUM_SKU, purchaseToken: purchaseData.purchaseToken }),
  });
  const data = await res.json();
  if (!res.ok || !data.isPremium) throw new Error(data.error || "Error al verificar la suscripción");
  return { isPremium: true };
}

export async function purchaseWorldCupPackOnPlay(playerId: string): Promise<{ granted: boolean }> {
  if (!isPlayBillingAvailable()) throw new Error("Google Play Billing no está disponible en este entorno");
  const service = await window.getDigitalGoodsService("https://play.google.com/billing");
  const { responseCode, purchaseData } = await (service as any).purchase(WORLD_CUP_SKU);
  if (responseCode !== 0) {
    if (responseCode === 5) throw { code: "PURCHASE_CANCELLED" };
    throw new Error(`Error en la compra: código ${responseCode}`);
  }
  const res = await fetch("/api/billing/play/verify-pack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, purchaseToken: purchaseData.purchaseToken, productId: WORLD_CUP_SKU }),
  });
  const data = await res.json();
  if (!res.ok || !data.granted) throw new Error(data.error || "Error al verificar el Pack Mundial");
  return { granted: true };
}

export async function restorePlayPurchases(): Promise<boolean> {
  if (typeof window === "undefined" || !window.getDigitalGoodsService) return false;
  try {
    const service = await window.getDigitalGoodsService("https://play.google.com/billing");
    const purchases = await (service as any).listPurchases();
    for (const purchase of purchases) {
      if (purchase.itemId !== PREMIUM_SKU || !purchase.purchaseToken) continue;
      const res = await fetch("/api/billing/play/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: PREMIUM_SKU, purchaseToken: purchase.purchaseToken }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.isPremium === true) return true;
      }
    }
  } catch {}
  return false;
}

export function detectPaymentChannel(): "play" | "stripe" {
  return isLikelyPlayTwa() ? "play" : "stripe";
}

export function isPlayPurchaseCancelled(error: any): boolean {
  return error?.code === "PURCHASE_CANCELLED" || error?.message?.includes("cancel");
}

export function isPlayBillingUnavailable(error: any): boolean {
  return error?.message?.includes("Google Play Billing no está disponible");
}

export interface PlayProduct {
  id: string;
  title: string;
  priceLabel: string;
}
