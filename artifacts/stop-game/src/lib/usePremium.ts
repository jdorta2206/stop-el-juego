import { useState, useEffect } from "react";
import { getApiUrl, authHeaders } from "@/lib/utils";
import { restorePlayPurchases, detectPaymentChannel, hasGooglePlayBillingApi } from "@/lib/playBilling";

const API_BASE = getApiUrl();
const PLAY_BILLING_METHOD = "https://play.google.com/billing";
const PREMIUM_SKU = "premium_monthly";

export interface PremiumStatus {
  isPremium: boolean;
  loading: boolean;
  error: string | null;
}

export interface PlayPremiumProduct {
  itemId: string;
  title?: string;
  description?: string;
  priceLabel?: string;
  price?: { value: string; currency: string };
}

export const PREMIUM_REFRESH_EVENT = "stop:premium-refresh";

export function notifyPremiumRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PREMIUM_REFRESH_EVENT));
  }
}

export function usePremium(playerId: string | null | undefined): PremiumStatus & { playProduct: PlayPremiumProduct | null } {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [playProduct, setPlayProduct] = useState<PlayPremiumProduct | null>(null);

  useEffect(() => {
    const handler = () => setRefreshTick((t) => t + 1);
    window.addEventListener(PREMIUM_REFRESH_EVENT, handler);
    return () => window.removeEventListener(PREMIUM_REFRESH_EVENT, handler);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPlayProduct = async () => {
      if (!hasGooglePlayBillingApi()) return;
      try {
        const service = await Promise.resolve(window.getDigitalGoodsService!(PLAY_BILLING_METHOD));
        const details = await service.getDetails([PREMIUM_SKU]);
        const product = details.find((item) => item.itemId === PREMIUM_SKU);
        if (!cancelled && product) {
          setPlayProduct({
            itemId: PREMIUM_SKU,
            title: product.title,
            description: product.description,
            price: product.price,
            priceLabel: product.price
              ? new Intl.NumberFormat("es-ES", {
                  style: "currency",
                  currency: product.price.currency,
                }).format(Number(product.price.value))
              : undefined,
          });
        }
      } catch {
        // Digital Goods is unavailable on normal web or may be injected later in the TWA.
      }
    };

    // Only load the Play product inside an actual Play TWA. Desktop Chrome may
    // expose Digital Goods too, but that must not change the web payment path.
    if (detectPaymentChannel() === "play") loadPlayProduct();
    return () => { cancelled = true; };
  }, [refreshTick]);

  useEffect(() => {
    if (!playerId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const channel = detectPaymentChannel();
    if (channel === "play") {
      restorePlayPurchases(playerId).catch(() => undefined);
    }

    // The web uses Stripe. Google Play status is queried only inside the TWA.
    // This avoids the old 404 spam from /api/billing/play/status on the web.
    const statusUrl = channel === "play"
      ? `${API_BASE}/api/billing/play/status?playerId=${encodeURIComponent(playerId)}`
      : `${API_BASE}/api/stripe/status?playerId=${encodeURIComponent(playerId)}`;

    fetch(statusUrl, { credentials: "include", headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) return { isPremium: false };
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setIsPremium(data?.isPremium === true);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [playerId, refreshTick]);

  return { isPremium, loading, error, playProduct };
}

export async function fetchPremiumProducts() {
  const res = await fetch(`${API_BASE}/api/stripe/products`);
  if (!res.ok) throw new Error("Failed to load products");
  return res.json() as Promise<{
    data: Array<{
      id: string;
      name: string;
      description: string;
      active: boolean;
      prices: Array<{
        id: string;
        unit_amount: number;
        currency: string;
        recurring: { interval: string } | null;
        active: boolean;
      }>;
    }>;
  }>;
}

export async function startCheckout(opts: {
  playerId: string;
  playerName: string;
  email?: string;
  priceId: string;
}) {
  const res = await fetch(`${API_BASE}/api/stripe/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Checkout failed");
  return data as { url: string };
}

export async function openCustomerPortal(playerId: string) {
  const res = await fetch(`${API_BASE}/api/stripe/portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify({ playerId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Portal failed");
  return data as { url: string };
}
