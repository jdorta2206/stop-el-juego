import { getApiUrl, authHeaders } from "@/lib/utils";

const API_BASE = getApiUrl();

export const WORLD_CUP_PACK_SKU = "pack_mundial";
export const WORLD_CUP_PACK_PRICE_LABEL = "2,99 €";

// Start a one-time Stripe checkout for the World Cup pack (web path). Returns
// the hosted checkout URL — the caller redirects there. On success Stripe
// sends the user back to `/?pack=success&session_id=...`, which App.tsx
// claims via `claimStripePack`.
export async function startPackCheckout(opts: {
  playerId: string;
  email?: string;
}): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/api/stripe/checkout-pack`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify({ ...opts, sku: WORLD_CUP_PACK_SKU }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Checkout failed");
  return data as { url: string };
}

// Confirm a completed Stripe pack purchase and grant the cosmetics. Safe to
// call repeatedly — the server grant is idempotent.
export async function claimStripePack(opts: {
  playerId: string;
  sessionId?: string;
}): Promise<{ granted: boolean }> {
  const res = await fetch(`${API_BASE}/api/stripe/claim-pack`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify(opts),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Claim failed");
  return data as { granted: boolean };
}
