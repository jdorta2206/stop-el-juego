import { getApiUrl, authHeaders } from "@/lib/utils";
import { purchaseWorldCupPackOnPlay, isPlayPurchaseCancelled } from "@/lib/playBilling";

const API_BASE = getApiUrl();

export const WORLD_CUP_PACK_SKU = "pack_mundial";
export const WORLD_CUP_PACK_PRICE_LABEL = "2,99 €";

export async function startPackCheckout(opts: {
  playerId: string;
  email?: string;
}): Promise<{ url: string }> {
  // 🔥 FUERZA GOOGLE PLAY BILLING SIN CONDICIÓN
  console.log("🔵 Forzando Google Play Billing para Pack Mundial");

  try {
    const result = await purchaseWorldCupPackOnPlay(opts.playerId);
    if (result.granted) {
      // Éxito: recargar la página para actualizar el inventario
      window.location.reload();
      return { url: "" };
    }
    throw new Error("No se pudo completar la compra con Google Play");
  } catch (error: any) {
    if (isPlayPurchaseCancelled(error)) {
      // Usuario canceló, no hacer nada
      console.log("ℹ️ Usuario canceló la compra en Google Play");
      return { url: "" };
    }
    console.error("❌ Google Play Billing falló:", error.message);
    // Mostrar error al usuario
    window.alert(`❌ Error al comprar con Google Play: ${error.message || "Error desconocido"}`);
    // Si falla, no abrimos Stripe (para probar)
    throw error;
  }
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
