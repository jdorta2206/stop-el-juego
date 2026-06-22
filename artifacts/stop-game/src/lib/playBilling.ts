// ============================================================
// playBilling.ts - Google Play Billing wrapper (frontend)
// ============================================================

const PREMIUM_SKU = "premium_monthly";
const WORLD_CUP_SKU = "pack_mundial";

/**
 * Detecta el canal de pago disponible.
 * - Si `window.getDigitalGoodsService` existe → estamos en una TWA con Play Billing → "play".
 * - En cualquier otro caso (web, navegador, etc.) → "stripe".
 * 
 * NOTA: Ya no usamos `document.referrer` porque en muchas TWA modernas no contiene
 * la información esperada, y lo fiable es la presencia de la API de Digital Goods.
 */
export function detectPaymentChannel(): "play" | "stripe" {
  if (typeof window === "undefined") return "stripe";
  const hasApi = typeof window.getDigitalGoodsService === "function";
  return hasApi ? "play" : "stripe";
}

/**
 * Indica si el usuario está en una TWA de Play Store (basado en el referrer).
 * Esta función se usa solo para fines promocionales (mostrar banners, etc.).
 * Para la detección del canal de pago, usa `detectPaymentChannel()`.
 */
export function hasAndroidAppReferrer(): boolean {
  if (typeof window === "undefined") return false;
  return document.referrer?.startsWith("android-app://") ?? false;
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

/**
 * Detecta si el usuario canceló la compra.
 */
export function isPlayPurchaseCancelled(error: any): boolean {
  return error?.code === "PURCHASE_CANCELLED" || error?.message?.includes("cancel");
}

/**
 * Detecta si el error indica que Play Billing no está disponible.
 */
export function isPlayBillingUnavailable(error: any): boolean {
  return error?.message?.includes("Google Play Billing no está disponible");
}
