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

/**
 * The TWA start URL contains a marker generated specifically for the
 * Google-Play-distributed Android package. This is deterministic and does
 * not depend on the Digital Goods API being injected before React renders.
 */
export function hasPlayTwaMarker(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.search.includes(PLAY_TWA_MARKER);
}

/**
 * PWABuilder/Bubblewrap also reports the installed Android build through
 * `?appVersion=` or the `STOPApp/<version>` UA token. This signal exists on
 * the very first React render, unlike getDigitalGoodsService(), which Chrome
 * may inject a little later. Pack Mundial used to miss Play at that moment
 * and permanently choose the Stripe branch for that render.
 */
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

  const paymentDetails = {
    total: {
      label: "Pack Mundial",
      amount: { currency: "EUR", value: "0.00" },
    },
  };

  if (typeof PaymentRequest !== "function") {
    throw new Error(
      "Google Play Billing está activado, pero este TWA no expone PaymentRequest. Hay que regenerar el paquete Android con Play Billing habilitado."
    );
  }

  const request = new PaymentRequest(paymentMethods, paymentDetails);
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
    body: JSON.stringify({ playerId, purchaseToken, productId: WORLD_CUP_SKU }),
  });

  const data = (await res.json().catch(() => ({}))) as { granted?: boolean; error?: string };
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

/**
 * Restores existing Google Play subscription purchases when the user opens
 * the Android TWA. Digital Goods API exposes existing purchases through
 * listPurchases(); each token is sent to the server, which verifies it with
 * Google Play before granting premium. This is intentionally a no-op on the
 * normal web/Stripe channel.
 */
export async function restorePlayPurchases(playerId?: string | null): Promise<void> {
  if (!isLikelyPlayTwa()) return;
  const service = await getPlayBillingService();
  const purchases = await service.listPurchases();
  const premiumPurchases = purchases.filter(
    (purchase) => purchase.itemId === PREMIUM_SKU && !!purchase.purchaseToken,
  );

  if (premiumPurchases.length === 0) return;

  // The server verifies every token against Google Play. If playerId is not
  // available yet, simply skip restoration and let the next premium refresh
  // retry once the player is known.
  if (!playerId) return;

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
