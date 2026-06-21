import { getApiUrl, authHeaders } from "@/lib/utils";
import { purchaseWorldCupPackOnPlay, isPlayPurchaseCancelled } from "@/lib/playBilling";

const API_BASE = getApiUrl();

export const WORLD_CUP_PACK_SKU = "pack_mundial";
export const WORLD_CUP_PACK_PRICE_LABEL = "2,99 €";

/**
 * Inicia el proceso de compra del Pack Mundial.
 * - SIEMPRE intenta Google Play Billing primero (si está disponible).
 * - Si falla (porque no está disponible o por otro error), usa Stripe como fallback.
 */
export async function startPackCheckout(opts: {
  playerId: string;
  email?: string;
}): Promise<{ url: string }> {
  // 🔵 INTENTAR GOOGLE PLAY BILLING SIEMPRE (sin comprobación previa)
  try {
    console.log("🔵 Intentando Google Play Billing para Pack Mundial");
    const result = await purchaseWorldCupPackOnPlay(opts.playerId);
    console.log("✅ Resultado de Google Play:", result);
    if (result.granted) {
      // Éxito: recargar la página para actualizar el inventario
      window.location.reload();
      return { url: "" };
    }
    // Si no se concede, lanzamos error para ir a Stripe
    throw new Error("No se pudo completar la compra con Google Play");
  } catch (error: any) {
    // Si el usuario cancela, no hacemos nada
    if (isPlayPurchaseCancelled(error)) {
      console.log("ℹ️ Usuario canceló la compra en Google Play");
      return { url: "" };
    }
    // Si falla por cualquier otro motivo (incluyendo no disponible), usamos Stripe
    console.warn("❌ Google Play Billing falló, usando Stripe:", error.message);
  }

  // 🌐 STRIPE (fallback)
  console.log("🌐 Usando Stripe para Pack Mundial");
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

/**
 * Confirma la compra del Pack Mundial (Stripe) y concede los cosméticos.
 */
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
