import { hasAndroidAppReferrer } from "@/lib/playBilling";

const TARGET_ORIGIN = "https://www.stopjuegodepalabras.com";
const REQUEST_TYPE = "STOP_AD_REQUEST_REWARDED";
const RESULT_TYPE = "STOP_AD_REWARDED_RESULT";
const HANDSHAKE_TYPE = "STOP_AD_BRIDGE_READY";
const REQUEST_TIMEOUT_MS = 90_000;

type RewardedPlacement = "extra_time" | "hint" | "double_points" | "skip_round" | "extra_pack";

type RewardResult = {
  rewarded: boolean;
  source: "admob" | "skipped" | "error";
};

type MessagePortState = {
  port: MessagePort | null;
  ready: boolean;
};

const state: MessagePortState = {
  port: null,
  ready: false,
};

let listenerInstalled = false;
const pending = new Map<string, (result: RewardResult) => void>();

function isAndroidTwa(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (hasAndroidAppReferrer()) return true;
    const params = new URLSearchParams(window.location.search);
    return params.get("source") === "googleplay-twa" || params.get("source") === "twa";
  } catch {
    return false;
  }
}

function installListener(): void {
  if (listenerInstalled || typeof window === "undefined") return;
  listenerInstalled = true;

  window.addEventListener("message", (event) => {
    if (event.origin !== TARGET_ORIGIN && event.origin !== window.location.origin) return;

    const data = event.data;
    const port = event.ports?.[0];

    if (port && (data === HANDSHAKE_TYPE || data?.type === HANDSHAKE_TYPE)) {
      state.port = port;
      state.ready = true;
      port.start();
      port.onmessage = (messageEvent) => handleMessage(messageEvent.data);
      return;
    }

    handleMessage(data);
  });
}

function handleMessage(data: unknown): void {
  if (!data || typeof data !== "object") return;
  const message = data as Record<string, unknown>;

  if (message.type === HANDSHAKE_TYPE) {
    state.ready = true;
    return;
  }

  if (message.type !== RESULT_TYPE || typeof message.requestId !== "string") return;

  const resolve = pending.get(message.requestId);
  if (!resolve) return;

  pending.delete(message.requestId);
  resolve({
    rewarded: message.rewarded === true,
    source: message.rewarded === true ? "admob" : "skipped",
  });
}

export function initTwaAdBridge(): void {
  installListener();
}

export function isTwaAdBridgeAvailable(): boolean {
  installListener();
  return isAndroidTwa() && state.ready && !!state.port;
}

export function requestRewardedAd(placement: RewardedPlacement): Promise<RewardResult> {
  installListener();

  if (!isTwaAdBridgeAvailable()) {
    return Promise.resolve({ rewarded: false, source: "error" });
  }

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise<RewardResult>((resolve) => {
    const timeout = window.setTimeout(() => {
      pending.delete(requestId);
      resolve({ rewarded: false, source: "error" });
    }, REQUEST_TIMEOUT_MS);

    pending.set(requestId, (result) => {
      window.clearTimeout(timeout);
      resolve(result);
    });

    try {
      state.port!.postMessage({
        type: REQUEST_TYPE,
        requestId,
        placement,
      });
    } catch {
      window.clearTimeout(timeout);
      pending.delete(requestId);
      resolve({ rewarded: false, source: "error" });
    }
  });
}
