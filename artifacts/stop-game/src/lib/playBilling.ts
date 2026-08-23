// ============================================================
// playBilling.ts - Google Play Billing wrapper (TWA frontend)
// ============================================================

const PLAY_BILLING_METHOD = "https://play.google.com/billing";
const PREMIUM_SKU = "premium_monthly";
const WORLD_CUP_SKU = "pack_mundial";
const PLAY_TWA_MARKER = "source=googleplay-twa";

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

export function hasGooglePlayBillingApi(): boolean {
  return typeof window !== "undefined"
    && typeof window.getDigitalGoodsService === "function";
}

export function hasAndroidAppReferrer(): boolean {
  if (typeof document === "undefined") return false;
  return document.referrer?.startsWith("android-app://") ?? false;
}

export function hasPlayTwaMarker(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.search.includes(PLAY_TWA_MARKER);
}

export function hasTwaVersionSignal(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  try {
    const appVersion = new URLSearchParams(window.location.search).get("appVersion");
    if (appVersion) return true;
  } catch {
    // Ignore malformed URL/search access.
  }
  return /STOPApp\/[0-9][0-9.]*/i.test(navigator.userAgent || "");
}

export function isLikelyPlayTwa(): boolean {
  if (hasPlayTwaMarker()) return true;
  if (hasTwaVersionSignal()) return true;
  if (hasGooglePlayBillingApi()) return true;
  if (hasAndroidAppReferrer()) return true;

  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }

  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  return isAndroid && isStandalone;
}

export function detectPaymentChannel(): "play" | "stripe" {
  return isLikelyPlayTwa() ? "play" : "stripe";
}

async function getPlayBillingService(): Promise<DigitalGoodsService> {
  if (!hasGooglePlayBillingApi()) {
    throw new Error(
      "Google Play Billing no está disponible en esta aplicación. Cierra y vuelve a abrir la app desde Google Play."
    );
  }

  try {
    return await window.getDigitalGoodsService!(PLAY_BILLING_METHOD);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Google Play Billing no está disponible: ${message}`);
  }
}

async function playPayment(
  playerId: string,
  sku: string,
  label: string,
  verifyEndpoint: string,
  productType: "onetime" | "subscription",
): Promise<void> {
  if (!playerId) throw new Error("Debes iniciar sesión para comprar.");

  const service = await getPlayBillingService();
  const details = await service.getDetails([sku]);
  if (!details.some((item) => item.itemId === sku)) {
    throw new Error(`Google Play no encuentra el producto ${sku}.`);
  }

  if (typeof PaymentRequest !== "function") {
    throw new Error(
      "Google Play Billing está activado, pero este TWA no expone PaymentRequest. Hay que regenerar el paquete Android con Play Billing habilitado."
    );
  }

  const request = new PaymentRequest(
    [{ supportedMethods: PLAY_BILLING_METHOD, data: { sku } }],
    {
      total: {
        label,
        // Google Play supplies the real price; this amount is only the
        // PaymentRequest placeholder required by the Digital Goods bridge.
        amount: { currency: "EUR", value: "0.00" },
      },
    },
  );

  const paymentResponse = await request.show();
  const responseDetails = paymentResponse.details as { purchaseToken?: string; token?: string };
  const purchaseToken = responseDetails.purchaseToken ?? responseDetails.token;

  if (!purchaseToken) {
    await paymentResponse.complete("fail").catch(() => undefined);
    throw new Error("Google Play no devolvió el token de compra.");
  }

  const res = await fetch(verifyEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ playerId, purchaseToken, productId: sku }),
  });

  const data = (await res.json().catch(() => ({}))) as { granted?: boolean; isPremium?: boolean; error?: string };
  if (!res.ok || (!data.granted && !data.isPremium)) {
    await paymentResponse.complete("fail").catch(() => undefined);
    throw new Error(data.error || "Error al verificar la compra de Google Play");
  }

  if (service.acknowledge) {
    await service.acknowledge(purchaseToken, productType).catch((error) => {
      console.warn("No se pudo confirmar la compra en Digital Goods API:", error);
    });
  }

  await paymentResponse.complete("success").catch(() => undefined);
}

/** Compra STOP Premium mediante Google Play dentro del TWA. */
export async function purchasePremiumOnPlay(playerId: string): Promise<{ isPremium: boolean }> {
  await playPayment(
    playerId,
    PREMIUM_SKU,
    "STOP Premium",
    "/api/billing/play/verify",
    "subscription",
  );
  return { isPremium: true };
}

export async function purchaseWorldCupPackOnPlay(playerId: string): Promise<{ granted: boolean }> {
  await playPayment(
    playerId,
    WORLD_CUP_SKU,
    "Pack Mundial",
    "/api/billing/play/verify-pack",
    "onetime",
  );
  return { granted: true };
}

export async function restorePlayPurchases(playerId?: string | null): Promise<void> {
  if (!isLikelyPlayTwa()) return;
  const service = await getPlayBillingService();
  const purchases = await service.listPurchases();
  const premiumPurchases = purchases.filter(
    (purchase) => purchase.itemId === PREMIUM_SKU && !!purchase.purchaseToken,
  );

  if (premiumPurchases.length === 0 || !playerId) return;

  for (const purchase of premiumPurchases) {
    try {
      const res = await fetch("/api/billing/play/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          playerId,
          purchaseToken: purchase.purchaseToken,
          productId: PREMIUM_SKU,
        }),
      });

      if (!res.ok) {
        console.warn("No se pudo restaurar la compra de Google Play:", await res.text().catch(() => ""));
        continue;
      }

      if (service.acknowledge) {
        await service.acknowledge(purchase.purchaseToken, "subscription").catch((error) => {
          console.warn("No se pudo confirmar la compra restaurada en Digital Goods API:", error);
        });
      }
    } catch (error) {
      console.warn("Error restaurando compra de Google Play:", error);
    }
  }
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
