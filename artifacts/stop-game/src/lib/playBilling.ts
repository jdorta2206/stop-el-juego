// ============================================================
// playBilling.ts - Google Play Billing wrapper (TWA frontend)
// ============================================================

const PLAY_BILLING_METHOD = "https://play.google.com/billing";
const PREMIUM_SKU = "premium_monthly";
const WORLD_CUP_SKU = "pack_mundial";

type DigitalGoodsService = {
  getDetails: (itemIds: string[]) => Promise<Array<{
    itemId?: string;
    title?: string;
    description?: string;
    price?: { value: string; currency: string };
  }>>;
  listPurchases: () => Promise<Array<{
    itemId: string;
    purchaseToken: string;
  }>>;
  acknowledge?: (purchaseToken: string, productType: "onetime" | "subscription") => Promise<void>;
  consume?: (purchaseToken: string) => Promise<void>;
};

declare global {
  interface Window {
    getDigitalGoodsService?: (storeId: string) => Promise<DigitalGoodsService>;
  }
}

/**
 * The Digital Goods API is the authoritative signal for Google Play Billing.
 * We deliberately do NOT pretend that Android/TWA detection alone means that
 * Play Billing is available: the native TWA must actually expose the provider.
 */
export function hasGooglePlayBillingApi(): boolean {
  return typeof window !== "undefined"
    && typeof window.getDigitalGoodsService === "function"
    && typeof PaymentRequest === "function";
}

export function detectPaymentChannel(): "play" | "stripe" {
  // Web/browser => Stripe.
  // Play Store TWA with the billing bridge => Play Billing.
  return hasGooglePlayBillingApi() ? "play" : "stripe";
}

export function hasAndroidAppReferrer(): boolean {
  if (typeof document === "undefined") return false;
  return document.referrer?.startsWith("android-app://") ?? false;
}

async function getPlayBillingService(): Promise<DigitalGoodsService> {
  if (!hasGooglePlayBillingApi()) {
    throw new Error(
      "Google Play Billing no está disponible. La aplicación Android debe generarse con Play Billing habilitado."
    );
  }

  try {
    return await window.getDigitalGoodsService!(PLAY_BILLING_METHOD);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Google Play Billing no está disponible: ${message}`);
  }
}

/**
 * Compra el Pack Mundial (pago único) con Google Play Billing.
 *
 * IMPORTANTE: Digital Goods API NO tiene service.purchase(). La compra se
 * inicia mediante PaymentRequest con el método https://play.google.com/billing.
 */
export async function purchaseWorldCupPackOnPlay(playerId: string): Promise<{ granted: boolean }> {
  if (!playerId) throw new Error("Debes iniciar sesión para comprar el Pack Mundial.");

  const service = await getPlayBillingService();

  const details = await service.getDetails([WORLD_CUP_SKU]);
  if (!details.some((item) => item.itemId === WORLD_CUP_SKU)) {
    throw new Error(`Google Play no encuentra el producto ${WORLD_CUP_SKU}.`);
  }

  const paymentMethods = [{
    supportedMethods: PLAY_BILLING_METHOD,
    data: { sku: WORLD_CUP_SKU },
  }];

  // Payment Request exige un total, pero Play Billing ignora estos valores
  // y utiliza el precio configurado en Play Console.
  const paymentDetails = {
    total: {
      label: "Pack Mundial",
      amount: { currency: "EUR", value: "0.00" },
    },
  };

  const request = new PaymentRequest(paymentMethods, paymentDetails);

  // Do not fall back to Stripe if Play cannot open the native payment sheet.
  // A Play-distributed app must use the Play Billing path for digital goods.
  const paymentResponse = await request.show();
  const responseDetails = paymentResponse.details as { purchaseToken?: string; token?: string };
  const purchaseToken = responseDetails.purchaseToken ?? responseDetails.token;

  if (!purchaseToken) {
    await paymentResponse.complete("fail").catch(() => undefined);
    throw new Error("Google Play no devolvió el token de compra.");
  }

  const res = await fetch("/api/billing/play/verify-pack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      playerId,
      purchaseToken,
      productId: WORLD_CUP_SKU,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    granted?: boolean;
    error?: string;
  };

  if (!res.ok || !data.granted) {
    await paymentResponse.complete("fail").catch(() => undefined);
    throw new Error(data.error || "Error al verificar el Pack Mundial");
  }

  if (service.acknowledge) {
    await service.acknowledge(purchaseToken, "onetime").catch((error) => {
      console.warn("No se pudo confirmar la compra en Digital Goods API:", error);
    });
  }

  await paymentResponse.complete("success").catch(() => undefined);
  return { granted: true };
}

export function isPlayPurchaseCancelled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; code?: string; message?: string };
  return candidate.name === "AbortError"
    || candidate.code === "PURCHASE_CANCELLED"
    || candidate.message?.toLowerCase().includes("cancel") === true;
}

export function isPlayBillingUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; message?: string };
  const message = candidate.message?.toLowerCase() ?? "";
  return candidate.name === "NotSupportedError"
    || message.includes("not supported")
    || message.includes("no está disponible")
    || message.includes("no esta disponible")
    || message.includes("billing no está disponible")
    || message.includes("billing no esta disponible");
}

export { PREMIUM_SKU, WORLD_CUP_SKU };
