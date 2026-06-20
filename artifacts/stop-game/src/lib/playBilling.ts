// ============================================================
// playBilling.ts - Google Play Billing wrapper (frontend)
// ============================================================

const PREMIUM_SKU = "premium_monthly";
const WORLD_CUP_SKU = "pack_mundial";

/**
 * Detecta si el canal de pago es Google Play o Stripe.
 * Se ejecuta una sola vez al cargar la app.
 */
export async function detectPaymentChannel(): Promise<"play" | "stripe"> {
  if (typeof window === "undefined") return "stripe";

  // 1. Detectar si estamos en una TWA de Play Store
  const isTwa = document.referrer?.startsWith("android-app://") ?? false;

  // 2. Detectar si la API de Google Play Billing está disponible
  const hasPlayBilling = typeof window.getDigitalGoodsService === "function";

  // 3. Si estamos en una TWA y la API existe, usamos Google Play
  if (isTwa && hasPlayBilling) {
    try {
      // Verificar que realmente funciona
      const service = await window.getDigitalGoodsService("https://play.google.com/billing");
      if (service) return "play";
    } catch {
      // Si falla, usamos Stripe
      return "stripe";
    }
  }

  return "stripe";
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
  if (typeof window === "undefined" || !window.getDigitalGoodsService) {
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
 * AHORA RECIBE playerId para poder conceder los cosméticos.
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

export interface PlayProduct {
  id: string;
  title: string;
  priceLabel: string;
}