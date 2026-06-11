import { getApiUrl, authHeaders } from "@/lib/utils";

const API_BASE = getApiUrl();

// ── TWA / Digital Goods detection ───────────────────────────────────────
// We are inside the Play Store TWA when:
//   1. document.referrer starts with android-app://, OR
//   2. window.getDigitalGoodsService is callable AND can resolve the
//      "https://play.google.com/billing" payment method.
// Rule (1) is cheap and fires immediately. Rule (2) is the authoritative
// check because that's the same gate Chrome uses to expose the API.

interface DigitalGoodsItemDetails {
  itemId: string;
  title: string;
  description: string;
  price: { currency: string; value: string };
}

interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<DigitalGoodsItemDetails[]>;
  listPurchases(): Promise<Array<{ itemId: string; purchaseToken: string }>>;
  consume?(purchaseToken: string): Promise<void>;
}

interface DigitalGoodsWindow extends Window {
  getDigitalGoodsService?: (paymentMethod: string) => Promise<DigitalGoodsService>;
}

const PLAY_BILLING_METHOD = "https://play.google.com/billing";
const PRODUCT_ID = "premium_monthly";
// One-time managed product unlocking every World Cup cosmetic at once.
export const PACK_PRODUCT_ID = "pack_mundial";

let cachedService: DigitalGoodsService | null = null;
let cachedChannel: "play" | "stripe" | null = null;

function isAndroidAppReferrer(): boolean {
  return typeof document !== "undefined" && document.referrer.startsWith("android-app://");
}

async function tryGetService(): Promise<DigitalGoodsService | null> {
  if (cachedService) return cachedService;
  const w = window as DigitalGoodsWindow;
  if (typeof w.getDigitalGoodsService !== "function") return null;
  try {
    const svc = await w.getDigitalGoodsService(PLAY_BILLING_METHOD);
    cachedService = svc;
    return svc;
  } catch {
    // Browser exposes the function but the payment method isn't available
    // (e.g. the user opened the URL outside the TWA context).
    return null;
  }
}

export async function detectPaymentChannel(): Promise<"play" | "stripe"> {
  if (cachedChannel) return cachedChannel;
  const svc = await tryGetService();
  // The Digital Goods service successfully resolving the Play Billing
  // payment method is the *authoritative* signal — Chrome only exposes it
  // when the page is running inside a Play Store TWA with the playBilling
  // feature enabled in the AAB manifest. The android-app:// referrer is a
  // useful corroborating hint but not required: in some TWA flows (deep
  // links, restored sessions) the referrer is empty, and that should NOT
  // force the user back to Stripe inside the Play Store app.
  cachedChannel = svc ? "play" : "stripe";
  return cachedChannel;
}

// Exposed for diagnostic UIs / debugging. The referrer alone is just a hint.
export function hasAndroidAppReferrer(): boolean {
  return isAndroidAppReferrer();
}

// ── Product details for the UI ──────────────────────────────────────────
// Returns price/title pulled directly from Google Play (so it shows in the
// user's local currency exactly as they will be charged). Falls back to a
// hardcoded "1,99 €/mes" if anything fails — the UI must not break.

export interface PlayProduct {
  itemId: string;
  title: string;
  priceLabel: string;
}

export async function fetchPlayProduct(): Promise<PlayProduct | null> {
  const svc = await tryGetService();
  if (!svc) return null;
  try {
    const details = await svc.getDetails([PRODUCT_ID]);
    const item = details[0];
    if (!item) return null;
    const formatted = new Intl.NumberFormat(navigator.language || "es-ES", {
      style: "currency",
      currency: item.price.currency,
    }).format(Number(item.price.value));
    return { itemId: item.itemId, title: item.title, priceLabel: formatted };
  } catch {
    return null;
  }
}

// ── Purchase flow ───────────────────────────────────────────────────────
// Lifts a PaymentRequest with the Play Billing payment method, sends the
// resulting purchaseToken to our server for re-validation against the
// Google Play Developer API, and resolves with the server's verdict.

export interface PlayPurchaseResult {
  isPremium: boolean;
  expiryTimeMs: number;
  state: string;
}

export async function purchasePremiumOnPlay(playerId: string): Promise<PlayPurchaseResult> {
  // Make sure we have a service first — fail fast with a clear error so the
  // caller can fall back to Stripe if something has changed since detection.
  const svc = await tryGetService();
  if (!svc) throw new Error("Google Play Billing no está disponible aquí");

  const methodData = [
    {
      supportedMethods: PLAY_BILLING_METHOD,
      data: { sku: PRODUCT_ID },
    },
  ];
  // PaymentRequest's `total` is required by the spec but ignored by Play
  // Billing — the SKU price set in Play Console is what's actually charged.
  const details = {
    total: { label: "Premium", amount: { currency: "EUR", value: "0" } },
  };

  const request = new PaymentRequest(methodData, details);
  const response = await request.show();
  // Best-effort complete — Play handles the UI either way.
  await response.complete("success").catch(() => {});

  const purchaseToken = (response.details as { purchaseToken?: string }).purchaseToken;
  if (!purchaseToken) throw new Error("No se recibió purchaseToken de Google Play");

  const verifyRes = await fetch(`${API_BASE}/api/billing/play/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ productId: PRODUCT_ID, purchaseToken }),
  });
  const verifyData = (await verifyRes.json()) as
    | PlayPurchaseResult
    | { error: string };
  if (!verifyRes.ok || "error" in verifyData) {
    const errMsg = "error" in verifyData ? verifyData.error : "Validación falló";
    throw new Error(errMsg);
  }
  return verifyData;
}

// ── World Cup pack price label (for the buy button inside the TWA) ───────
export async function fetchPlayPackPriceLabel(): Promise<string | null> {
  const svc = await tryGetService();
  if (!svc) return null;
  try {
    const details = await svc.getDetails([PACK_PRODUCT_ID]);
    const item = details[0];
    if (!item) return null;
    return new Intl.NumberFormat(navigator.language || "es-ES", {
      style: "currency",
      currency: item.price.currency,
    }).format(Number(item.price.value));
  } catch {
    return null;
  }
}

// ── World Cup pack purchase (one-time) via Google Play ──────────────────
// Same PaymentRequest flow as premium, but the SKU is a managed product and
// the server grants cosmetics instead of premium.
export async function purchaseWorldCupPackOnPlay(): Promise<{ granted: boolean }> {
  const svc = await tryGetService();
  if (!svc) throw new Error("Google Play Billing no está disponible aquí");

  const methodData = [
    { supportedMethods: PLAY_BILLING_METHOD, data: { sku: PACK_PRODUCT_ID } },
  ];
  const details = {
    total: { label: "Pack Mundial", amount: { currency: "EUR", value: "0" } },
  };

  const request = new PaymentRequest(methodData, details);
  const response = await request.show();
  await response.complete("success").catch(() => {});

  const purchaseToken = (response.details as { purchaseToken?: string }).purchaseToken;
  if (!purchaseToken) throw new Error("No se recibió purchaseToken de Google Play");

  const res = await fetch(`${API_BASE}/api/billing/play/verify-pack`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify({ productId: PACK_PRODUCT_ID, purchaseToken }),
  });
  const data = (await res.json().catch(() => ({}))) as
    | { granted: boolean }
    | { error: string };
  if (!res.ok || "error" in data) {
    const msg = "error" in data ? data.error : "Validación falló";
    throw new Error(msg);
  }
  return data;
}

// ── Error classification for the purchase UI ────────────────────────────
// The Digital Goods service can resolve (so we pick the "play" channel) on a
// TWA whose AAB was NOT actually built with Play Billing enabled. In that case
// `PaymentRequest.show()` rejects with a NotSupportedError ("The payment method
// 'https://play.google.com/billing' is not supported"). We treat that — and our
// own "no está disponible" guard — as "fall back to Stripe" rather than dead-
// ending the user. A user-dismissed Play sheet (AbortError) must NOT fall back.
export function isPlayPurchaseCancelled(e: unknown): boolean {
  return typeof DOMException !== "undefined"
    && e instanceof DOMException
    && e.name === "AbortError";
}

export function isPlayBillingUnavailable(e: unknown): boolean {
  if (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "NotSupportedError") {
    return true;
  }
  const msg = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
  return msg.includes("not supported")
    || msg.includes("no está disponible")
    || msg.includes("play.google.com/billing");
}

// ── Restore (e.g. user already paid on another device) ──────────────────
// Walks listPurchases() and re-verifies each token against the server.
// Useful on app start so a returning subscriber sees premium without having
// to re-purchase.
export async function restorePlayPurchases(): Promise<boolean> {
  const svc = await tryGetService();
  if (!svc) return false;
  try {
    const purchases = await svc.listPurchases();
    for (const p of purchases) {
      if (p.itemId !== PRODUCT_ID) continue;
      const r = await fetch(`${API_BASE}/api/billing/play/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: PRODUCT_ID, purchaseToken: p.purchaseToken }),
      });
      if (r.ok) {
        const data = (await r.json()) as PlayPurchaseResult;
        if (data.isPremium) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
