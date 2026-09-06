// ============================================================
// playBilling.ts - Google Play Billing wrapper (frontend)
// ============================================================

// 🔧 Declaración de tipo para window.getDigitalGoodsService
declare global {
  interface Window {
    getDigitalGoodsService: (url: string) => Promise<any>;
  }
}

const PREMIUM_SKU = "premium_monthly";
const WORLD_CUP_SKU = "pack_mundial";

// Funciones auxiliares para otros componentes
export function detectPaymentChannel(): "play" | "stripe" {
  if (typeof window === "undefined") return "stripe";
  const isTwa = document.referrer?.startsWith("android-app://") ?? false;
  const hasApi = typeof window.getDigitalGoodsService === "function";
  return isTwa && hasApi ? "play" : "stripe";
}

export function hasAndroidAppReferrer(): boolean {
  if (typeof window === "undefined") return false;
  return document.referrer?.startsWith("android-app://") ?? false;
}

/**
 * Restores an existing Google Play subscription in the server after a TWA
 * launch. The Digital Goods API is only available in the Android TWA, so
 * this is a no-op elsewhere. Restoration is best-effort and never blocks
 * the normal premium status request.
 */
export async function restorePlayPurchases(playerId: string): Promise<void> {
  if (typeof window === "undefined" || typeof window.getDigitalGoodsService !== "function") {
    return;
  }
  if (!playerId) return;

  const service = await window.getDigitalGoodsService("https://play.google.com/billing");
  if (typeof service.listPurchases !== "function") return;

  const result = await service.listPurchases();
  const purchases = Array.isArray(result) ? result : result?.purchases;
  if (!Array.isArray(purchases)) return;

  for (const purchase of purchases) {
    const productId = purchase?.itemId ?? purchase?.productId;
    const purchaseToken = purchase?.purchaseToken;
    if (productId !== PREMIUM_SKU || typeof purchaseToken !== "string" || !purchaseToken) {
      continue;
    }

    const response = await fetch("/api/billing/play/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ playerId, productId, purchaseToken }),
    });

    // Continue through other purchases if one verification fails.
    if (!response.ok) continue;
  }
}

/**
 * Compra el Pack Mundial (pago único) con Google Play Billing.
 * Recibe playerId para conceder los cosméticos.
 */
export async function purchaseWorldCupPackOnPlay(playerId: string): Promise<{ granted: boolean }> {
  if (typeof window === "undefined" || !window.getDigitalGoodsService) {
    throw new Error("Google Play Billing no está disponible en este entorno");
  }

  const service = await window.getDigitalGoodsService("https://play.google.com/billing");
  const { responseCode, purchaseData } = await service.purchase(WORLD_CUP_SKU);

  if (responseCode !== 0) {
    if (responseCode === 5) throw { code: "PURCHASE_CANCELLED" };
    throw new Error(`Error en la compra: código ${responseCode}`);
  }

  const res = await fetch("/api/billing/play/verify-pack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerId,
      purchaseToken: purchaseData.purchaseToken,
      productId: WORLD_CUP_SKU,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.granted) {
    throw new Error(data.error || "Error al verificar el Pack Mundial");
  }

  return { granted: true };
}

export function isPlayPurchaseCancelled(error: any): boolean {
  return error?.code === "PURCHASE_CANCELLED" || error?.message?.includes("cancel");
}

export function isPlayBillingUnavailable(error: any): boolean {
  return error?.message?.includes("Google Play Billing no está disponible");
}
