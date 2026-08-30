import { getApiUrl, authHeaders } from "@/lib/utils";

const API_BASE = getApiUrl();

export const WORLD_CUP_PACK_SKU = "pack_mundial";
export const WORLD_CUP_PACK_PRICE_LABEL = "2,99 €";

/**
 * Web checkout for the World Cup pack.
 * Android TWA must NOT call this function: CosmeticShop selects Google Play
 * through the shared payment-channel detector. This function is the Stripe
 * path for ordinary web traffic only.
 */
export async function startPackCheckout(opts: {
  playerId: string;
  email?: string;
}): Promise<{ url: string }> {
  if (!opts.playerId) throw new Error("Debes iniciar sesión antes de comprar el Pack Mundial");

  const res = await fetch(`${API_BASE}/api/stripe/checkout-pack`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify({
      playerId: opts.playerId,
      email: opts.email,
      sku: WORLD_CUP_PACK_SKU,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw new Error(data.error || "No se pudo iniciar el pago con Stripe");
  }
  return { url: data.url as string };
}

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
