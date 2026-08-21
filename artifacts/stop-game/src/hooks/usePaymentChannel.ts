import { useEffect, useState } from "react";
import { detectPaymentChannel, hasGooglePlayBillingApi, isLikelyPlayTwa } from "@/lib/playBilling";

export type PaymentChannel = "play" | "stripe";

/**
 * Payment channel detection must not be a one-shot render-time decision.
 *
 * In a Google Play TWA, Chrome can inject the Digital Goods API shortly
 * after the React app has rendered. The old implementation initialized to
 * Stripe and called detectPaymentChannel() only once. That created a race:
 * the Premium modal could detect Play after its effect ran, while the
 * one-time Pack Mundial button could already have captured `stripe` and
 * sent the user to Stripe.
 */
export function usePaymentChannel() {
  const [channel, setChannel] = useState<PaymentChannel | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const resolve = () => {
      if (cancelled) return;

      // The TWA marker / Android standalone detection is deterministic and
      // does not require the Digital Goods API to have been injected yet.
      if (isLikelyPlayTwa() || hasGooglePlayBillingApi()) {
        setChannel("play");
        return;
      }

      // Give the TWA a short window to inject Digital Goods before deciding
      // this is ordinary web traffic. This removes the Stripe race without
      // delaying normal web users for long.
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
