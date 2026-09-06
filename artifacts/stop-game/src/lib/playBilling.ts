// ============================================================
// playBilling.ts - Google Play Billing wrapper (frontend)
// ============================================================

declare global {
  interface Window {
    getDigitalGoodsService: (url: string) => Promise<any>;
  }
}

const PREMIUM_SKU = "premium_monthly";
const WORLD_CUP_SKU = "pack_mundial";
const PLAY_BILLING_METHOD = "https://play.google.com/billing";

function isPlayBillingAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.getDigitalGoodsService === "function";
}

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("stop_session_token") || sessionStorage.getItem("stop_session_token");
    return token ? { "x-stop-token": token } : {};
  } catch {
    return {};
  }
}

export function detectPaymentChannel(): "play" | "stripe" {
  if (typeof window === "undefined") return "stripe";
  const isTwa = document.referrer?.startsWith("android-app://") ?? false;
  return isTwa && isPlayBillingAvailable() ? "play" : "stripe";
}

export function hasAndroidAppReferrer(): boolean {
  if (typeof window === "undefined") return false;
  return document.referrer?.startsWith("android-app://") ?? false;
}

/**
 * Starts the Google Play subscription checkout in a Trusted Web Activity.
 * DigitalGoodsService exposes product/purchase state, while PaymentRequest
 * is the checkout mechanism used by the TWA Play Billing bridge.
 */
export async function purchasePremiumOnPlay(playerId: string): Promise<{ isPremium: boolean }> {
  if (!playerId) throw new Error("Debes iniciar sesión antes de comprar Premium");
  if (!isPlayBillingAvailable()) {
    throw new Error("Google Play Billing no está disponible en este entorno");
  }
  if (typeof PaymentRequest === "undefined") {
    throw new Error("El pago de Google Play no está disponible en este dispositivo");
  }

  const request = new PaymentRequest(
    [{ supportedMethods: PLAY_BILLING_METHOD, data: { sku: PREMIUM_SKU } }],
    {
      total: {
        label: "STOP - El Juego",
        amount: { currency: "EUR", value: "0" },
      },
    },
  );

  const response = await request.show();
  const purchaseToken = response?.details?.purchaseToken ?? response?.details?.token;

  if (!purchaseToken || typeof purchaseToken !== "string") {
    try { await response.complete("fail"); } catch { /* best effort */ }
    throw new Error("Google Play no devolvió el token de compra");
  }

  try {
    const res = await fetch("/api/billing/play/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ playerId, productId: PREMIUM_SKU, purchaseToken }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.isPremium !== true) {
      throw new Error(data.error || "Error al verificar la suscripción");
    }

    try { await response.complete("success"); } catch { /* best effort */ }
    return { isPremium: true };
  } catch (error) {
    try { await response.complete("fail"); } catch { /* best effort */ }
    throw error;
  }
}

/**
 * Restores an existing Google Play subscription after a TWA launch.
 * This is best-effort and is a no-op outside the Android TWA.
 */
export async function restorePlayPurchases(playerId: string): Promise<void> {
  if (!isPlayBillingAvailable() || !playerId) return;

  try {
    const service = await window.getDigitalGoodsService(PLAY_BILLING_METHOD);
    if (typeof service.listPurchases !== "function") return;

    const result = await service.listPurchases();
    const purchases = Array.isArray(result) ? result : result?.purchases;
    if (!Array.isArray(purchases)) return;

    for (const purchase of purchases) {
      const productId = purchase?.itemId ?? purchase?.productId;
      const purchaseToken = purchase?.purchaseToken;
      if (productId !== PREMIUM_SKU || typeof purchaseToken !== "string" || !purchaseToken) continue;

      try {
        await fetch("/api/billing/play/verify", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ playerId, productId, purchaseToken }),
        });
      } catch {
        // Restore is deliberately best-effort; status remains the source of truth.
      }
    }
  } catch {
    // Billing API may be unavailable during normal web use or TWA startup.
  }
}

/**
 * Compra el Pack Mundial (pago único) con Google Play Billing.
 */
export async function purchaseWorldCupPackOnPlay(playerId: string): Promise<{ granted: boolean }> {
  if (!isPlayBillingAvailable()) {
    throw new Error("Google Play Billing no está disponible en este entorno");
  }
  if (typeof PaymentRequest === "undefined") {
    throw new Error("El pago de Google Play no está disponible en este dispositivo");
  }
  if (!playerId) throw new Error("Debes iniciar sesión antes de comprar el Pack Mundial");

  const request = new PaymentRequest(
    [{ supportedMethods: PLAY_BILLING_METHOD, data: { sku: WORLD_CUP_SKU } }],
    {
      total: {
        label: "STOP - El Juego",
        amount: { currency: "EUR", value: "0" },
      },
    },
  );

  const response = await request.show();
  const purchaseToken = response?.details?.purchaseToken ?? response?.details?.token;
  if (!purchaseToken || typeof purchaseToken !== "string") {
    try { await response.complete("fail"); } catch { /* best effort */ }
    throw new Error("Google Play no devolvió el token de compra");
  }

  try {
    const res = await fetch("/api/billing/play/verify-pack", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ playerId, purchaseToken, productId: WORLD_CUP_SKU }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.granted !== true) {
      throw new Error(data.error || "Error al verificar el Pack Mundial");
    }
    try { await response.complete("success"); } catch { /* best effort */ }
    return { granted: true };
  } catch (error) {
    try { await response.complete("fail"); } catch { /* best effort */ }
    throw error;
  }
}

export function isPlayPurchaseCancelled(error: any): boolean {
  return error?.code === "PURCHASE_CANCELLED" || error?.name === "AbortError" || String(error?.message || "").toLowerCase().includes("cancel");
}

export function isPlayBillingUnavailable(error: any): boolean {
  return String(error?.message || "").includes("Google Play Billing no está disponible");
}
