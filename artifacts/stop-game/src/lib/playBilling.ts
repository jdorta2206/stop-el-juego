import { getApiUrl } from "@/lib/utils";

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
  // We require BOTH the API to be present AND the android-app referrer to
  // safely route through Play. Either alone is too weak: Chrome on desktop
  // exposes getDigitalGoodsService stubs in some flags configurations, and
  // the referrer can be spoofed by a malicious deep link.
  if (svc && isAndroidAppReferrer()) {
    cachedChannel = "play";
  } else {
    cachedChannel = "stripe";
  }
  return cachedChannel;
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
