import { useState, useEffect } from "react";
import { getApiUrl, authHeaders } from "@/lib/utils";
import { restorePlayPurchases, detectPaymentChannel } from "@/lib/playBilling";

const API_BASE = getApiUrl();

export interface PremiumStatus { isPremium: boolean; loading: boolean; error: string | null; }
export const PREMIUM_REFRESH_EVENT = "stop:premium-refresh";
export function notifyPremiumRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PREMIUM_REFRESH_EVENT));
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
    if (!playerId) {
      setIsPremium(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        if (detectPaymentChannel() === "play") {
          const restored = await restorePlayPurchases(playerId);
          if (!cancelled && restored) {
            setIsPremium(true);
            notifyPremiumRefresh();
          }
        }
      } catch {
        // Play restore is best-effort; the authoritative status request below
        // remains the source of truth.
      }
    })();

    void (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/billing/play/status?playerId=${encodeURIComponent(playerId)}`, {
          credentials: "include", headers: authHeaders(),
        });
        let data: any;
        if (r.ok) {
          data = await r.json();
        } else {
          const fallback = await fetch(`${API_BASE}/api/stripe/status?playerId=${encodeURIComponent(playerId)}`, {
            credentials: "include", headers: authHeaders(),
          });
          data = await fallback.json();
        }
        if (!cancelled) setIsPremium(data?.isPremium === true);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "No se pudo comprobar Premium");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [playerId, refreshTick]);

  return { isPremium, loading, error };
}

export async function fetchPremiumProducts() {
  const res = await fetch(`${API_BASE}/api/stripe/products`);
  if (!res.ok) throw new Error("Failed to load products");
  return res.json();
}

export async function startCheckout(opts: { playerId: string; playerName: string; email?: string; priceId: string }) {
  const res = await fetch(`${API_BASE}/api/stripe/checkout`, {
    method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include", body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Checkout failed");
  return data as { url: string };
}

export async function openCustomerPortal(playerId: string) {
  const res = await fetch(`${API_BASE}/api/stripe/portal`, {
    method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include", body: JSON.stringify({ playerId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Portal failed");
  return data as { url: string };
}
