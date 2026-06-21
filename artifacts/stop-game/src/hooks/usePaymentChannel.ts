import { useState, useEffect } from "react";
import { isPlayBillingAvailable, fetchPlayProduct, type PlayProduct } from "@/lib/playBilling";

export function usePaymentChannel() {
  const [channel, setChannel] = useState<"loading" | "play" | "stripe">("loading");
  const [playProduct, setPlayProduct] = useState<PlayProduct | null>(null);

  useEffect(() => {
    let mounted = true;

    const detect = async () => {
      const available = isPlayBillingAvailable();
      if (!mounted) return;

      if (available) {
        setChannel("play");
        const product = await fetchPlayProduct();
        if (mounted) setPlayProduct(product);
      } else {
        setChannel("stripe");
      }
    };

    detect();

    return () => {
      mounted = false;
    };
  }, []);

  return { channel, playProduct };
}
