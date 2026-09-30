import { useState, useEffect, useCallback, useRef } from "react";
import { getApiUrl } from "@/lib/utils";

const API_BASE = getApiUrl();
const VAPID_PUBLIC =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  "BOwVNL3sEONgyFulirkX5dzwQo662jY2_C846OSMrTSfiz4GFwEsl3_1NY3x_GqJIco8P7Ls85u56IRC3Y8Bj2c";
const DISABLED_KEY = "stop_push_notifications_disabled";

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
  const currentPlayerIdRef = useRef(playerId);
  const preferencesAbortRef = useRef<AbortController | null>(null);
  currentPlayerIdRef.current = playerId;

  useEffect(() => {
    let cancelled = false;

    const controller = new AbortController();
    const initialise = async () => {
      try {
        if (!("Notification" in window) || !("serviceWorker" in navigator)) {
          if (!cancelled) setPermission("unsupported");
          return;
        }

        const perm = Notification.permission as NotifPermission;
        if (!cancelled) setPermission(perm);

        const reg = await navigator.serviceWorker.ready;
        if (cancelled) return;

        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;

        // Prioritize the browser's actual persisted Push API subscription.
        if (sub) {
          setIsSubscribed(true);
          try { localStorage.removeItem(DISABLED_KEY); } catch {}
        } else {
          let disabled = false;
          try { disabled = localStorage.getItem(DISABLED_KEY) === "1"; } catch {}
          setIsSubscribed(!disabled);
          return;
        }

        if (perm === "granted" && !cancelled && currentPlayerIdRef.current === playerId) {
          const tzOffsetMinutes = -new Date().getTimezoneOffset();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
          try {
            if (currentPlayerIdRef.current !== playerId) return;
            const res = await fetch(`${API_BASE}/api/notifications/subscribe`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                playerId: playerId || "anonymous",
                subscription: sub.toJSON(),
                language,
                tzOffsetMinutes,
                timeZone,
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
    return () => { cancelled = true; controller.abort(); };
  }, [playerId, language]);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC || !("serviceWorker" in navigator)) return false;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm as NotifPermission);
      if (perm !== "granted") return false;

      try { localStorage.removeItem(DISABLED_KEY); } catch {}

      const existing = await reg.pushManager.getSubscription();
      if (currentPlayerIdRef.current !== playerId) return false;
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
          timeZone,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      });

      if (!res.ok) throw new Error(`subscription HTTP ${res.status}`);
      if (currentPlayerIdRef.current !== playerId) return false;
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
    preferencesAbortRef.current?.abort();
    const controller = new AbortController();
    preferencesAbortRef.current = controller;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return null;
      const res = await fetch(
        `${API_BASE}/api/notifications/preferences?endpoint=${encodeURIComponent(sub.endpoint)}&playerId=${encodeURIComponent(playerId || "anonymous")}`,
        { signal: controller.signal },
      );
      if (!res.ok || controller.signal.aborted || currentPlayerIdRef.current !== playerId) return null;
      return await res.json();
    } catch { return null; }
    finally {
      if (preferencesAbortRef.current === controller) preferencesAbortRef.current = null;
    }
  }, [playerId]);

  const updatePreferences = useCallback(async (patch: {
    enabled?: boolean; hourLocal?: number; muteDays?: number;
  }): Promise<boolean> => {
    if (!("serviceWorker" in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return false;
      if (currentPlayerIdRef.current !== playerId) return false;
      const res = await fetch(`${API_BASE}/api/notifications/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, playerId: playerId || "anonymous", ...patch }),
      });
      return res.ok;
    } catch { return false; }
  }, [playerId]);

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      try { localStorage.setItem(DISABLED_KEY, "1"); } catch {}

      if (sub) {
        if (currentPlayerIdRef.current !== playerId) return;
        try {
          await fetch(`${API_BASE}/api/notifications/unsubscribe`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint, playerId: playerId || "anonymous" }),
          });
        } catch (e) {
          console.warn("[push] unsubscribe server request failed", e);
        }
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (e) {
      console.error("Push unsubscribe error:", e);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => () => preferencesAbortRef.current?.abort(), [playerId]);

  const isSupported = "Notification" in window && "serviceWorker" in navigator && !!VAPID_PUBLIC;

  return { permission, isSubscribed, loading, subscribe, unsubscribe, isSupported, getPreferences, updatePreferences };
}
