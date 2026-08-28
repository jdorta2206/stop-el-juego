// ============================================================
// playBilling.ts - Google Play Billing wrapper (frontend)
// ============================================================

const PREMIUM_SKU = "premium_monthly";
const WORLD_CUP_SKU = "pack_mundial";

/**
 * Detecta si estamos en una TWA de Play Store con Google Play Billing disponible.
 * Ahora depende de window.getDigitalGoodsService, no de document.referrer.
 */
export function isPlayBillingAvailable(): boolean {
  if (typeof window === "undefined") return false;
  // Priorizamos la presencia de la API, no el referrer
  return typeof window.getDigitalGoodsService === "function";
}

/**
 * Obtiene los detalles del producto de Google Play (para mostrar el precio localizado).
 */
export async function fetchPlayProduct(): Promise<PlayProduct | null> {
  if (typeof window === "undefined" || !window.getDigitalGoodsService) {
    return null;
  }

  try {
    const service = await window.getDigitalGoodsService("https://play.google.com/billing");
    const details = await service.getDetails([PREMIUM_SKU]);
    if (details && details.length > 0) {
      return {
        id: details[0].productId,
        title: details[0].title,
        priceLabel: details[0].price,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Compra la suscripción Premium (mensual) con Google Play Billing.
 */
export async function purchasePremiumOnPlay(playerId: string): Promise<{ isPremium: boolean }> {
  if (!isPlayBillingAvailable()) {
    throw new Error("Google Play Billing no está disponible en este entorno");
  }

  const service = await window.getDigitalGoodsService("https://play.google.com/billing");
  const { responseCode, purchaseData } = await service.purchase(PREMIUM_SKU);

  if (responseCode !== 0) {
    if (responseCode === 5) throw new Error("PURCHASE_CANCELLED");
    throw new Error(`Error en la compra: código ${responseCode}`);
  }

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
 * Recibe playerId para conceder los cosméticos.
 */
export async function purchaseWorldCupPackOnPlay(playerId: string): Promise<{ granted: boolean }> {
  if (!isPlayBillingAvailable()) {
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

export async function restorePlayPurchases(): Promise<boolean> {
  if (typeof window === "undefined" || !window.getDigitalGoodsService) return false;

  try {
    const service = await window.getDigitalGoodsService("https://play.google.com/billing");
    const purchases = await service.listPurchases();

    for (const purchase of purchases) {
      if (purchase.itemId !== PREMIUM_SKU || !purchase.purchaseToken) continue;

      const res = await fetch("/api/billing/play/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId: PREMIUM_SKU,
          purchaseToken: purchase.purchaseToken,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.isPremium === true) return true;
      }
    }
  } catch {
    // Restauración voluntaria: nunca debe impedir iniciar el juego.
  }

  return false;
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
