import { useState, useEffect } from "react";
import { getApiUrl, authHeaders } from "@/lib/utils";

const API_BASE = getApiUrl();
const OAUTH_ID_PREFIXES = ["google_", "fb_", "apple_", "tt_"];

export interface PremiumStatus { isPremium: boolean; loading: boolean; error: string | null; }
export const PREMIUM_REFRESH_EVENT = "stop:premium-refresh";

export function notifyPremiumRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PREMIUM_REFRESH_EVENT));
}

/**
 * Premium is an account entitlement, never a browser/device entitlement.
 * Guests and local-only profiles are therefore ineligible for Premium even
 * if Google Play exposes a purchase on the same device.
 */
function isPremiumEligibleAccount(playerId: string): boolean {
  return OAUTH_ID_PREFIXES.some((prefix) => playerId.startsWith(prefix));
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
    // Hard invariant: no player or guest/local profile can ever be Premium.
    if (!playerId || !isPremiumEligibleAccount(playerId)) {
      setIsPremium(false);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    // Never carry Premium across an account switch while the new entitlement
    // is being resolved.
    setIsPremium(false);

    void (async () => {
      try {
        // This endpoint is the single authoritative entitlement check. It
        // validates the authenticated player identity server-side and resolves
        // Stripe OR an owned active Google Play subscription.
        const r = await fetch(
          `${API_BASE}/api/billing/play/status?playerId=${encodeURIComponent(playerId)}`,
          { credentials: "include", headers: authHeaders(), cache: "no-store" },
        );

        if (!r.ok) {
          throw new Error(`Premium status unavailable (${r.status})`);
        }

        const data: any = await r.json();
        if (!cancelled) setIsPremium(data?.isPremium === true);
      } catch (err: any) {
        if (!cancelled) {
          // Fail closed: an unavailable/unauthorized entitlement check must
          // never turn a non-paying account into Premium.
          setIsPremium(false);
          setError(err?.message || "No se pudo comprobar Premium");
        }
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
