import { useEffect, useState } from "react";
import { detectPaymentChannel, fetchPlayProduct, isLikelyPlayTwa, type PlayProduct } from "@/lib/playBilling";

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
  const [playProduct, setPlayProduct] = useState<PlayProduct | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    const startedAt = Date.now();

    const resolve = () => {
      if (cancelled) return;

      // Only the shared detector may decide that this is Play Billing.
      // It requires a strong Android/TWA signal or Android-only fallback
      // signals; a desktop browser can therefore never become "play" just
      // because DigitalGoodsService happens to exist.
      if (isLikelyPlayTwa()) {
        setChannel("play");
        void fetchPlayProduct().then((product) => {
          if (!cancelled) setPlayProduct(product);
        });
        return;
      }

      // Give a genuine Android TWA a short opportunity to expose its runtime
      // signals before falling back to ordinary web/Stripe.
      if (Date.now() - startedAt < 3000) {
        timeoutId = window.setTimeout(resolve, 100);
      } else {
        setChannel(detectPaymentChannel());
      }
    };

    resolve();
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  return {
    channel,
    isPlay: channel === "play",
    isReady: channel !== "loading",
    playProduct,
  };
}
