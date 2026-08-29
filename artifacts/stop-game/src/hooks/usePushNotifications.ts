import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/utils";

const API_BASE = getApiUrl();
const VAPID_PUBLIC =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  "BOwVNL3sEONgyFulirkX5dzwQo662Yj2_C846OSMrTSfiz4GFwEsl3_1NY3x_GqJIco8P7Ls85u56IRC3Y8Bj2c";

function urlB64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))) as Uint8Array<ArrayBuffer>;
}

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications(playerId: string | undefined, language: string) {
  const [permission, setPermission] = useState<NotifPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initialise = async () => {
      try {
        if (!("Notification" in window) || !("serviceWorker" in navigator)) {
          if (!cancelled) setPermission("unsupported");
          return;
        }

        if (!cancelled) setPermission(Notification.permission as NotifPermission);

        const reg = await navigator.serviceWorker.ready;
        if (cancelled) return;

        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;

        setIsSubscribed(!!sub);

        // IMPORTANT: re-register an existing browser/TWA subscription even
        // when there is no account yet. This repairs subscriptions lost from
        // the server DB after a deploy and keeps guest devices eligible for
        // daily notifications. The server treats "anonymous" as a guest row.
        if (sub) {
          const tzOffsetMinutes = -new Date().getTimezoneOffset();
          try {
            const res = await fetch(`${API_BASE}/api/notifications/subscribe`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                playerId: playerId || "anonymous",
                subscription: sub.toJSON(),
                language,
                tzOffsetMinutes,
                origin: window.location.origin,
              }),
            });
            if (!res.ok) console.warn("[push] subscription backfill failed", res.status);
          } catch (e) {
            console.warn("[push] subscription backfill error", e);
          }
        }
      } catch (e) {
        console.warn("[push] initialise error", e);
      }
    };

    void initialise();
    return () => { cancelled = true; };
  }, [playerId, language]);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC || !("serviceWorker" in navigator)) return false;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm as NotifPermission);
      if (perm !== "granted") { setLoading(false); return false; }

      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
      });

      const tzOffsetMinutes = -new Date().getTimezoneOffset();
      const res = await fetch(`${API_BASE}/api/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: playerId || "anonymous",
          subscription: sub.toJSON(),
          language,
          hourLocal: 20,
          tzOffsetMinutes,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      });

      if (!res.ok) throw new Error(`subscription HTTP ${res.status}`);
      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error("Push subscribe error:", e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [playerId, language]);

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
