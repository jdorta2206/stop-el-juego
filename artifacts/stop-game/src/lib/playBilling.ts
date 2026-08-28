// Google Play Billing for Trusted Web Activity.
const PREMIUM_SKU = "premium_monthly";
const WORLD_CUP_SKU = "pack_mundial";
const PLAY_BILLING_METHOD = "https://play.google.com/billing";

export function isPlayBillingAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.getDigitalGoodsService === "function";
}
export function hasGooglePlayBillingApi(): boolean { return isPlayBillingAvailable(); }
export function hasAndroidAppReferrer(): boolean {
  return typeof document !== "undefined" && document.referrer?.startsWith("android-app://") === true;
}
export function hasPlayTwaMarker(): boolean {
  return typeof window !== "undefined" && window.location.search.includes("source=googleplay-twa");
}
export function hasTwaVersionSignal(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return new URLSearchParams(window.location.search).has("appVersion") || /STOPApp\/[0-9][0-9.]*/i.test(navigator.userAgent || "");
}
export function isLikelyPlayTwa(): boolean {
  if (hasPlayTwaMarker() || hasTwaVersionSignal() || hasGooglePlayBillingApi() || hasAndroidAppReferrer()) return true;
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "") && (window.matchMedia?.("(display-mode: standalone")?.matches ?? false);
}
function authHeadersSafe(): Record<string, string> {
  try {
    const token = localStorage.getItem("stop_session_token") || sessionStorage.getItem("stop_session_token");
    return token ? { "x-stop-token": token } : {};
  } catch { return {}; }
}
export async function fetchPlayProduct(): Promise<PlayProduct | null> {
  if (!isPlayBillingAvailable()) return null;
  try {
    const service = await window.getDigitalGoodsService!(PLAY_BILLING_METHOD);
    const details = await service.getDetails([PREMIUM_SKU]);
    const p: any = details?.[0];
    return p ? { id: p.productId ?? p.itemId, title: p.title, priceLabel: p.price } : null;
  } catch { return null; }
}
/** DigitalGoodsService has no purchase(). PaymentRequest starts Play checkout in a TWA. */
async function makePlayPurchase(sku: string): Promise<{ service: any; response: any; purchaseToken: string }> {
  if (!isPlayBillingAvailable()) throw new Error("Google Play Billing no está disponible en este entorno");
  if (typeof PaymentRequest === "undefined") throw new Error("El pago de Google Play no está disponible en este dispositivo");
  const service = await window.getDigitalGoodsService!(PLAY_BILLING_METHOD);
  const request = new PaymentRequest(
    [{ supportedMethods: PLAY_BILLING_METHOD, data: { sku } }],
    { total: { label: "STOP - El Juego", amount: { currency: "EUR", value: "0" } } },
  );
  const response = await request.show();
  const purchaseToken = response?.details?.purchaseToken ?? response?.details?.token;
  if (!purchaseToken) {
    try { await response.complete("fail"); } catch {}
    throw new Error("Google Play no devolvió el token de compra");
  }
  return { service, response, purchaseToken };
}
export async function purchasePremiumOnPlay(playerId: string): Promise<{ isPremium: boolean }> {
  if (!playerId) throw new Error("Debes iniciar sesión antes de comprar Premium");
  const { response, purchaseToken } = await makePlayPurchase(PREMIUM_SKU);
  try {
    const res = await fetch("/api/billing/play/verify", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...authHeadersSafe() }, body: JSON.stringify({ playerId, productId: PREMIUM_SKU, purchaseToken }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.isPremium !== true) throw new Error(data.error || "Error al verificar la suscripción");
    try { await response.complete("success"); } catch {}
    return { isPremium: true };
  } catch (e) { try { await response.complete("fail"); } catch {} throw e; }
}
export async function purchaseWorldCupPackOnPlay(playerId: string): Promise<{ granted: boolean }> {
  if (!playerId) throw new Error("Debes iniciar sesión antes de comprar el Pack Mundial");
  const { service, response, purchaseToken } = await makePlayPurchase(WORLD_CUP_SKU);
  try {
    const res = await fetch("/api/billing/play/verify-pack", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...authHeadersSafe() }, body: JSON.stringify({ playerId, productId: WORLD_CUP_SKU, purchaseToken }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.granted !== true) throw new Error(data.error || "Error al verificar el Pack Mundial");
    try { if (typeof service.consume === "function") await service.consume(purchaseToken); } catch {}
    try { await response.complete("success"); } catch {}
    return { granted: true };
  } catch (e) { try { await response.complete("fail"); } catch {} throw e; }
}
export async function restorePlayPurchases(playerId: string): Promise<boolean> {
  if (!isPlayBillingAvailable() || !playerId) return false;
  try {
    const service = await window.getDigitalGoodsService!(PLAY_BILLING_METHOD);
    const purchases = await (service as any).listPurchases();
    for (const purchase of purchases || []) {
      const itemId = purchase.itemId ?? purchase.productId;
      if (itemId !== PREMIUM_SKU || !purchase.purchaseToken) continue;
      const res = await fetch("/api/billing/play/verify", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...authHeadersSafe() }, body: JSON.stringify({ playerId, productId: PREMIUM_SKU, purchaseToken: purchase.purchaseToken }) });
      if (!res.ok) continue;
      const data = await res.json().catch(() => ({}));
      if (data.isPremium === true) return true;
    }
  } catch {}
  return false;
}
export function detectPaymentChannel(): "play" | "stripe" { return isLikelyPlayTwa() ? "play" : "stripe"; }
export function isPlayPurchaseCancelled(error: any): boolean { return error?.code === "PURCHASE_CANCELLED" || error?.name === "AbortError" || String(error?.message || "").toLowerCase().includes("cancel"); }
export function isPlayBillingUnavailable(error: any): boolean { return String(error?.message || "").includes("Google Play Billing no está disponible"); }
export interface PlayProduct { id: string; title: string; priceLabel: string; }
