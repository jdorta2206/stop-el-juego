// ============================================================
// playBilling.ts - Google Play Billing wrapper (frontend)
// ============================================================

const PREMIUM_SKU = "premium_monthly";
const WORLD_CUP_SKU = "pack_mundial";

export function isPlayBillingAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.getDigitalGoodsService === "function";
}

export function hasGooglePlayBillingApi(): boolean { return isPlayBillingAvailable(); }
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
  if (hasPlayTwaMarker() || hasTwaVersionSignal() || hasGooglePlayBillingApi() || hasAndroidAppReferrer()) return true;
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "") && (window.matchMedia?.("(display-mode: standalone)")?.matches ?? false);
}

function authHeadersSafe(): Record<string, string> {
  try {
    const token = localStorage.getItem("stop_session_token") || sessionStorage.getItem("stop_session_token");
    return token ? { "x-stop-token": token } : {};
  } catch { return {}; }
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
  } catch {}
  return null;
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
    headers: { "Content-Type": "application/json", ...authHeadersSafe() },
    credentials: "include",
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
    headers: { "Content-Type": "application/json", ...authHeadersSafe() },
    credentials: "include",
    body: JSON.stringify({ playerId, purchaseToken: purchaseData.purchaseToken, productId: WORLD_CUP_SKU }),
  });
  const data = await res.json();
  if (!res.ok || !data.granted) throw new Error(data.error || "Error al verificar el Pack Mundial");
  return { granted: true };
}

// Restore an existing Google Play subscription into the CURRENT logged-in STOP account.
// The previous implementation omitted playerId, while the server requires it, so every
// restore request was rejected with 400 and a paid subscription never reached the account.
export async function restorePlayPurchases(playerId: string): Promise<boolean> {
  if (typeof window === "undefined" || !window.getDigitalGoodsService || !playerId) return false;
  try {
    const service = await window.getDigitalGoodsService("https://play.google.com/billing");
    const purchases = await (service as any).listPurchases();
    for (const purchase of purchases) {
      const itemId = purchase.itemId ?? purchase.productId;
      if (itemId !== PREMIUM_SKU || !purchase.purchaseToken) continue;
      const res = await fetch("/api/billing/play/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeadersSafe() },
        credentials: "include",
        body: JSON.stringify({ playerId, productId: PREMIUM_SKU, purchaseToken: purchase.purchaseToken }),
      });
      if (!res.ok) continue;
      const data = await res.json().catch(() => ({}));
      if (data?.isPremium === true) return true;
    }
  } catch {}
  return false;
}

export function detectPaymentChannel(): "play" | "stripe" { return isLikelyPlayTwa() ? "play" : "stripe"; }
export function isPlayPurchaseCancelled(error: any): boolean { return error?.code === "PURCHASE_CANCELLED" || error?.message?.includes("cancel"); }
export function isPlayBillingUnavailable(error: any): boolean { return error?.message?.includes("Google Play Billing no está disponible"); }
export interface PlayProduct { id: string; title: string; priceLabel: string; }
