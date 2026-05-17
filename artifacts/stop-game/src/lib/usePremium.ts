import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/utils";
import { restorePlayPurchases, detectPaymentChannel } from "@/lib/playBilling";

const API_BASE = getApiUrl();

export interface PremiumStatus {
  isPremium: boolean;
  loading: boolean;
  error: string | null;
}

// Custom DOM event other components fire after a successful purchase or
// portal action — listeners refetch immediately so premium UI updates
// without a page reload (required by the no-reload UX of the Play flow,
// where window.location.href would lose Digital Goods state).
export const PREMIUM_REFRESH_EVENT = "stop:premium-refresh";

export function notifyPremiumRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PREMIUM_REFRESH_EVENT));
  }
}

export function usePremium(playerId: string | null | undefined): PremiumStatus {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const handler = () => setRefreshTick((t) => t + 1);
    window.addEventListener(PREMIUM_REFRESH_EVENT, handler);
    return () => window.removeEventListener(PREMIUM_REFRESH_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!playerId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Auto-restore: if we're inside the Play Store TWA, replay any existing
    // purchases through /verify on every app open. This self-heals the case
    // where the original /verify failed (server config, permission
    // propagation, network) and the user is left with a paid subscription
    // the server doesn't know about. No-op on Stripe / regular web.
    detectPaymentChannel().then((channel) => {
      if (cancelled || channel !== "play") return;
      restorePlayPurchases().catch(() => {
        // Silent — restore is best-effort, the status fetch below is the
        // source of truth for the UI.
      });
    });

    // Unified premium status — checks Stripe AND Google Play, so a TWA user
    // with a Play subscription gets premium even though they have no Stripe
    // customer id. Falls back to /api/stripe/status if the unified endpoint
    // returns 5xx (e.g. cold start race during deploy).
    fetch(`${API_BASE}/api/billing/play/status?playerId=${encodeURIComponent(playerId)}`, {
      credentials: "include",
    })
      .then(async (r) => {
        if (r.ok) return r.json();
        const fallback = await fetch(
          `${API_BASE}/api/stripe/status?playerId=${encodeURIComponent(playerId)}`,
        );
        return fallback.json();
      })
      .then((data) => {
        if (!cancelled) setIsPremium(data.isPremium === true);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [playerId, refreshTick]);

  return { isPremium, loading, error };
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Checkout failed");
  return data as { url: string };
}

export async function openCustomerPortal(playerId: string) {
  const res = await fetch(`${API_BASE}/api/stripe/portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Portal failed");
  return data as { url: string };
}
