import { hasAndroidAppReferrer } from "@/lib/playBilling";

// Source of truth: the Play Store association declared in
// `attached_assets/assetlinks_*.json` (Digital Asset Links) and the
// `related_applications` block in `artifacts/stop-game/public/manifest.json`,
// both of which point to this package id. Do NOT confuse with the legacy
// `android/twa-manifest.json` which contains a stale local Bubblewrap config
// from a previous build and is no longer used to publish.
export const PLAY_PACKAGE_ID = "app.replit.stop_el_juego.twa";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE_ID}`;

interface ReviewWindow extends Window {
  AndroidInAppReview?: { requestReview?: () => void };
  chrome?: { webview?: unknown };
}

function looksLikeTwa(): boolean {
  if (typeof window === "undefined") return false;
  if (hasAndroidAppReferrer()) return true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === "twa" || params.get("utm_source") === "twa") return true;
    const ua = navigator.userAgent || "";
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.matchMedia?.("(display-mode: fullscreen)").matches ?? false);
    if (isStandalone && /Android/i.test(ua) && /; wv\)|Version\//.test(ua) === false && !/Chrome\/[0-9.]+ Mobile/.test(ua)) {
      return false;
    }
    return isStandalone && /Android/i.test(ua) && document.referrer === "";
  } catch {
    return false;
  }
}

export async function requestPlayReview(): Promise<"native" | "fallback"> {
  const w = window as ReviewWindow;
  try {
    if (looksLikeTwa() && w.AndroidInAppReview?.requestReview) {
      w.AndroidInAppReview.requestReview();
      return "native";
    }
  } catch {}
  try {
    window.open(PLAY_STORE_URL, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = PLAY_STORE_URL;
  }
  return "fallback";
}
