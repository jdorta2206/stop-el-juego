import { useEffect, useState } from "react";
import { detectPaymentChannel, isLikelyPlayTwa } from "@/lib/playBilling";

export type PaymentChannel = "play" | "stripe";

/**
 * Detect Play only from TWA-specific signals. The Digital Goods API can also
 * exist in desktop Chrome, so its mere presence must not switch the public
 * website away from Stripe.
 */
export function usePaymentChannel() {
  const [channel, setChannel] = useState<PaymentChannel | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const resolve = () => {
      if (cancelled) return;

      // Deterministic TWA signals first. No Digital Goods API check here.
      if (isLikelyPlayTwa()) {
        setChannel("play");
        return;
      }

      // Give Android TWA startup a short window for its URL/standalone
      // signals to settle, while keeping normal web traffic on Stripe.
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
