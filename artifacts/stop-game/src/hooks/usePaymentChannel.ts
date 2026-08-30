import { useEffect, useState } from "react";
import { detectPaymentChannel, isLikelyPlayTwa } from "@/lib/playBilling";

export type PaymentChannel = "play" | "stripe";

/**
 * Resolve the payment channel without allowing a weak browser capability to
 * classify ordinary web traffic as a Google Play TWA.
 *
 * The detector in playBilling.ts is the single source of truth. In
 * particular, getDigitalGoodsService is NOT checked independently here.
 */
export function usePaymentChannel() {
  const [channel, setChannel] = useState<PaymentChannel | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const resolve = () => {
      if (cancelled) return;

      // Only the shared detector may decide that this is Play Billing.
      // It requires a strong Android/TWA signal or Android-only fallback
      // signals; a desktop browser can therefore never become "play" just
      // because DigitalGoodsService happens to exist.
      if (isLikelyPlayTwa()) {
        setChannel("play");
        return;
      }

      // Give a genuine Android TWA a short opportunity to expose its runtime
      // signals before falling back to ordinary web/Stripe.
      if (Date.now() - startedAt < 3000) {
        window.setTimeout(resolve, 100);
      } else {
        setChannel(detectPaymentChannel());
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    channel,
    isPlay: channel === "play",
    isReady: channel !== "loading",
  };
}
