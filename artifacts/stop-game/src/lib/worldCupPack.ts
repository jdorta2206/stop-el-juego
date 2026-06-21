import { getApiUrl, authHeaders } from "@/lib/utils";
import { purchaseWorldCupPackOnPlay, isPlayPurchaseCancelled } from "@/lib/playBilling";

const API_BASE = getApiUrl();

export const WORLD_CUP_PACK_SKU = "pack_mundial";
export const WORLD_CUP_PACK_PRICE_LABEL = "2,99 €";

/**
 * Inicia el proceso de compra del Pack Mundial.
 * - DETECCIÓN DIRECTA: si window.getDigitalGoodsService existe, usa Google Play.
 * - Si falla o no existe, usa Stripe como fallback.
 */
export async function startPackCheckout(opts: {
  playerId: string;
  email?: string;
}): Promise<{ url: string }> {
  // 🔍 DETECCIÓN DIRECTA (sin depender de channel)
  const hasPlayBilling = typeof window !== "undefined" &&
    typeof window.getDigitalGoodsService === "function";

  // Si estamos en la app de Play Store, intentar Google Play Billing
  if (hasPlayBilling) {
    try {
      console.log("🔵 [worldCupPack] Intentando Google Play Billing");
      const result = await purchaseWorldCupPackOnPlay(opts.playerId);
      if (result.granted) {
        // Éxito: recargar y salir sin abrir Stripe
        window.location.reload();
        // Devolvemos una URL vacía para que no redirija a Stripe
        return { url: "" };
      }
      // Si no se concede, lanzamos error para ir a Stripe
      throw new Error("No se pudo completar la compra con Google Play");
    } catch (error: any) {
      if (isPlayPurchaseCancelled(error)) {
        // Usuario canceló, no hacemos nada
        console.log("ℹ️ Usuario canceló la compra en Google Play");
        return { url: "" };
      }
      // Si falla por otro motivo, continuamos a Stripe
      console.warn("❌ Google Play Billing falló, usando Stripe:", error.message);
    }
  } else {
    console.log("🌐 [worldCupPack] No se detectó Google Play, usando Stripe");
  }

  // 🌐 STRIPE (fallback para web o si Play Billing falla)
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
