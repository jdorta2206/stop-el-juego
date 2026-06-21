import { getApiUrl, authHeaders } from "@/lib/utils";
import { purchaseWorldCupPackOnPlay, isPlayPurchaseCancelled } from "@/lib/playBilling";

const API_BASE = getApiUrl();

export const WORLD_CUP_PACK_SKU = "pack_mundial";
export const WORLD_CUP_PACK_PRICE_LABEL = "2,99 €";

/**
 * Inicia el proceso de compra del Pack Mundial.
 * - Si estamos en la app de Play Store (Google Play Billing disponible), intenta con Google Play.
 * - Si falla o no está disponible, usa Stripe como fallback.
 */
export async function startPackCheckout(opts: {
  playerId: string;
  email?: string;
}): Promise<{ url: string }> {
  // ✅ DETECTAR SI ESTAMOS EN LA APP DE PLAY STORE
  const hasPlayBilling = typeof window !== "undefined" &&
    typeof window.getDigitalGoodsService === "function";

  if (hasPlayBilling) {
    // 🔵 USAR GOOGLE PLAY BILLING
    try {
      console.log("🔵 Intentando Google Play Billing para Pack Mundial");
      const result = await purchaseWorldCupPackOnPlay(opts.playerId);
      console.log("✅ Resultado de Google Play:", result);
      if (result.granted) {
        // Éxito: recargar la página para actualizar el inventario
        window.location.reload();
        // Devolvemos una URL vacía pero con un flag de éxito
        return { url: "" };
      }
      throw new Error("No se pudo completar la compra con Google Play");
    } catch (error: any) {
      if (isPlayPurchaseCancelled(error)) {
        // Usuario canceló, no hacemos nada
        console.log("ℹ️ Usuario canceló la compra en Google Play");
        return { url: "" };
      }
      // Si falla por otro motivo, intentamos con Stripe como fallback
      console.warn("❌ Google Play Billing falló, usando Stripe como fallback:", error.message);
      // Continuamos a Stripe
    }
  }

  // 🌐 STRIPE (fallback para web o si Play Billing falla)
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
 * Solo se usa después de Stripe.
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
