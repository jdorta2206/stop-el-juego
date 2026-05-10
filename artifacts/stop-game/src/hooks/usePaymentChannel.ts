import { useEffect, useState } from "react";
import { detectPaymentChannel, fetchPlayProduct, type PlayProduct } from "@/lib/playBilling";

export interface PaymentChannelState {
  channel: "play" | "stripe" | "loading";
  playProduct: PlayProduct | null;
}

// Resolves the payment channel exactly once per session. On the Stripe path
// `playProduct` stays null; the existing Stripe products fetch handles UI.
// On the Play path we eagerly fetch product details so the modal can show
// the localized price coming from Google Play (which may differ from the
// €1,99 listed on the web because Google does per-region pricing).
export function usePaymentChannel(): PaymentChannelState {
  const [channel, setChannel] = useState<"play" | "stripe" | "loading">("loading");
  const [playProduct, setPlayProduct] = useState<PlayProduct | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await detectPaymentChannel();
      if (cancelled) return;
      setChannel(c);
      if (c === "play") {
        const p = await fetchPlayProduct();
        if (!cancelled) setPlayProduct(p);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { channel, playProduct };
}
