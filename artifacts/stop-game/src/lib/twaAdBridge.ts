import { isLikelyPlayTwa } from "@/lib/playBilling";

const TARGET_ORIGIN = "https://www.stopjuegodepalabras.com";
const ANDROID_APP_ORIGIN = "android-app://app.replit.stop_el_juego.twa";
const REQUEST_TYPE = "STOP_AD_REQUEST_REWARDED";
const RESULT_TYPE = "STOP_AD_REWARDED_RESULT";
const HANDSHAKE_TYPE = "STOP_AD_BRIDGE_READY";
const REQUEST_TIMEOUT_MS = 90_000;
const CHANNEL_READY_TIMEOUT_MS = 8_000;

type RewardedPlacement = "extra_time" | "hint" | "double_points" | "skip_round" | "extra_pack";
type RewardResult = { rewarded: boolean; source: "admob" | "skipped" | "error" };
type MessagePortState = { port: MessagePort | null; ready: boolean };

const state: MessagePortState = { port: null, ready: false };
let listenerInstalled = false;
const pending = new Map<string, (result: RewardResult) => void>();

function isAndroidTwa(): boolean {
  try { return isLikelyPlayTwa(); } catch { return false; }
}

function normalizeMessage(data: unknown): Record<string, unknown> | null {
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch { return data === HANDSHAKE_TYPE ? { type: HANDSHAKE_TYPE } : null; }
  }
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

function resetPort(): void {
  const port = state.port;
  state.port = null;
  state.ready = false;
  try { port?.close(); } catch {}
}

function handleMessage(data: unknown): void {
  const message = normalizeMessage(data);
  if (!message) return;
  if (message.type === HANDSHAKE_TYPE) { state.ready = true; return; }
  if (message.type !== RESULT_TYPE || typeof message.requestId !== "string") return;
  const resolve = pending.get(message.requestId);
  if (!resolve) return;
  pending.delete(message.requestId);
  resolve({
    rewarded: message.rewarded === true,
    source: message.rewarded === true ? "admob" : message.source === "error" ? "error" : "skipped",
  });
}

function installListener(): void {
  if (listenerInstalled || typeof window === "undefined") return;
  listenerInstalled = true;
  window.addEventListener("message", (event) => {
    const isTrustedTwaOrigin = event.origin === ANDROID_APP_ORIGIN;
    if (event.origin !== TARGET_ORIGIN && event.origin !== window.location.origin && !isTrustedTwaOrigin) return;
    const port = event.ports?.[0];
    if (port) {
      if (state.port && state.port !== port) resetPort();
      state.port = port;
      state.ready = true;
      port.start();
      port.onmessage = (messageEvent) => handleMessage(messageEvent.data);
    }
    handleMessage(event.data);
  });
}

function waitForReady(timeoutMs: number): Promise<boolean> {
  if (state.ready && state.port) return Promise.resolve(true);
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (state.ready && state.port) { window.clearInterval(timer); resolve(true); }
      else if (Date.now() - started >= timeoutMs) { window.clearInterval(timer); resolve(false); }
    }, 50);
  });
}

export function initTwaAdBridge(): void { installListener(); }

export function isTwaAdBridgeAvailable(): boolean {
  installListener();
  return isAndroidTwa() && state.ready && !!state.port;
}

export async function requestRewardedAd(placement: RewardedPlacement): Promise<RewardResult> {
  installListener();
  if (!isAndroidTwa()) return { rewarded: false, source: "error" };
  if (!(await waitForReady(CHANNEL_READY_TIMEOUT_MS))) return { rewarded: false, source: "error" };
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise<RewardResult>((resolve) => {
    const timeout = window.setTimeout(() => {
      pending.delete(requestId);
      resetPort();
      resolve({ rewarded: false, source: "error" });
    }, REQUEST_TIMEOUT_MS);
    pending.set(requestId, (result) => { window.clearTimeout(timeout); resolve(result); });
    try { state.port!.postMessage({ type: REQUEST_TYPE, requestId, placement }); }
    catch {
      window.clearTimeout(timeout);
      pending.delete(requestId);
      resetPort();
      resolve({ rewarded: false, source: "error" });
    }
  });
}
