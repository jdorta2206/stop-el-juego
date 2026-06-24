import { useState, useEffect } from "react";
import { detectPaymentChannel } from "@/lib/playBilling";

export function usePaymentChannel() {
  const [channel, setChannel] = useState<"play" | "stripe">("stripe");

  useEffect(() => {
    setChannel(detectPaymentChannel());
  }, []);

  return { channel };
}