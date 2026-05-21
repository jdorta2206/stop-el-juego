import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/utils";

const API_BASE = getApiUrl();
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlB64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))) as Uint8Array<ArrayBuffer>;
}

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

// playerId is optional — guests can still subscribe for daily notifications
export function usePushNotifications(playerId: string | undefined, language: string) {
  const [permission, setPermission] = useState<NotifPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as NotifPermission);

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    }).catch(() => {});
  }, []);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC || !("serviceWorker" in navigator)) return false;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm as NotifPermission);
      if (perm !== "granted") { setLoading(false); return false; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
      });

      // `getTimezoneOffset()` returns positive minutes WEST of UTC; we flip
      // the sign so the server sees offset minutes EAST (Madrid summer = +120).
      // We send 20 as the FIRST-TIME default — the server's UPSERT keeps any
      // previously chosen hour on resubscribe so toggling off/on doesn't
      // reset the user's pick from /notificaciones.
      const tzOffsetMinutes = -new Date().getTimezoneOffset();
      await fetch(`${API_BASE}/api/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: playerId || "anonymous",
          subscription: sub.toJSON(),
          language,
          hourLocal: 20,
          tzOffsetMinutes,
        }),
      });

      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error("Push subscribe error:", e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [playerId, language]);

  // ── Preferences (hour, mute, enabled) ───────────────────────────────────
  // Loaded lazily by the Settings page; not called on mount to avoid an
  // extra round-trip for users who never visit the settings.
  const getPreferences = useCallback(async (): Promise<{
    enabled: boolean; hourLocal: number; mutedUntil: number; tzOffsetMinutes: number;
  } | null> => {
    if (!("serviceWorker" in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return null;
      const res = await fetch(
        `${API_BASE}/api/notifications/preferences?endpoint=${encodeURIComponent(sub.endpoint)}`,
      );
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }, []);

  const updatePreferences = useCallback(async (patch: {
    enabled?: boolean; hourLocal?: number; muteDays?: number;
  }): Promise<boolean> => {
    if (!("serviceWorker" in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return false;
      const res = await fetch(`${API_BASE}/api/notifications/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, ...patch }),
      });
      return res.ok;
    } catch { return false; }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${API_BASE}/api/notifications/unsubscribe`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (e) {
      console.error("Push unsubscribe error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const isSupported = "Notification" in window && "serviceWorker" in navigator && !!VAPID_PUBLIC;

  return { permission, isSubscribed, loading, subscribe, unsubscribe, isSupported, getPreferences, updatePreferences };
}
