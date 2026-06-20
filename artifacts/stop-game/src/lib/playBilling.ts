// ============================================================
// playBilling.ts - Google Play Billing wrapper (frontend)
// ============================================================

const PREMIUM_SKU = "premium_monthly";
const WORLD_CUP_SKU = "pack_mundial";

/**
 * Compra la suscripción Premium (mensual) con Google Play Billing.
 */
export async function purchasePremiumOnPlay(playerId: string): Promise<{ isPremium: boolean }> {
  if (typeof window === "undefined" || !window.getDigitalGoodsService) {
    throw new Error("Google Play Billing no está disponible en este entorno");
  }

  const service = await window.getDigitalGoodsService("https://play.google.com/billing");
  const { responseCode, purchaseData } = await service.purchase(PREMIUM_SKU);

  if (responseCode !== 0) {
    if (responseCode === 5) throw new Error("PURCHASE_CANCELLED");
    throw new Error(`Error en la compra: código ${responseCode}`);
  }

  // Verificar con el backend
  const res = await fetch("/api/billing/play/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerId,
      productId: PREMIUM_SKU,
      purchaseToken: purchaseData.purchaseToken,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.isPremium) {
    throw new Error(data.error || "Error al verificar la suscripción");
  }

  return { isPremium: true };
}

/**
 * Compra el Pack Mundial (pago único) con Google Play Billing.
 */
export async function purchaseWorldCupPackOnPlay(): Promise<{ granted: boolean }> {
  if (typeof window === "undefined" || !window.getDigitalGoodsService) {
    throw new Error("Google Play Billing no está disponible en este entorno");
  }

  const service = await window.getDigitalGoodsService("https://play.google.com/billing");
  const { responseCode, purchaseData } = await service.purchase(WORLD_CUP_SKU);

  if (responseCode !== 0) {
    if (responseCode === 5) throw { code: "PURCHASE_CANCELLED" };
    throw new Error(`Error en la compra: código ${responseCode}`);
  }

  // Verificar con el backend
  const res = await fetch("/api/billing/play/verify-pack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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
 * Detecta si una excepción es de cancelación por el usuario.
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