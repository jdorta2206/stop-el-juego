import { useState, useEffect, useCallback, useRef } from "react";
import { getApiUrl } from "@/lib/utils";

const API_BASE = getApiUrl();
const BUILD_VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
const DISABLED_KEY = "stop_push_notifications_disabled";

function urlB64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))) as Uint8Array<ArrayBuffer>;
}

async function getServerVapidPublicKey(signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${API_BASE}/api/notifications/vapid-public-key`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`VAPID public key HTTP ${response.status}`);
  const data: unknown = await response.json();
  const key = typeof data === "object" && data !== null && "key" in data
    ? (data as { key?: unknown }).key
    : undefined;
  if (typeof key !== "string" || !key.trim()) {
    throw new Error("Server VAPID public key is not configured");
  }
  // A configured build key must match the server key; otherwise new
  // subscriptions could never be delivered by the server's private key.
  if (BUILD_VAPID_PUBLIC && BUILD_VAPID_PUBLIC !== key) {
    throw new Error("Client and server VAPID public keys do not match");
  }
  return key;
}

function sameApplicationServerKey(subscription: PushSubscription, publicKey: string): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const expected = urlB64ToUint8Array(publicKey);
  const actual = new Uint8Array(current);
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
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
        if (!sub) {
          if (!cancelled) setIsSubscribed(false);
          return;
        }
        if (perm !== "granted" || currentPlayerIdRef.current !== playerId) {
          if (!cancelled) setIsSubscribed(false);
          return;
        }
        const tzOffsetMinutes = -new Date().getTimezoneOffset();
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
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
        if (!res.ok) {
          if (!cancelled) setIsSubscribed(false);
          console.warn("[push] subscription backfill failed", res.status);
          return;
        }
        if (!cancelled && currentPlayerIdRef.current === playerId) {
          try { localStorage.removeItem(DISABLED_KEY); } catch {}
          setIsSubscribed(true);
        }
      } catch (e) {
        if (!controller.signal.aborted) console.warn("[push] initialise error", e);
      }
    };
    void initialise();
    return () => { cancelled = true; controller.abort(); };
  }, [playerId, language]);

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm as NotifPermission);
      if (perm !== "granted") return false;

      // Fetch the server's authoritative public key before creating a
      // subscription. Never silently create one with a stale build-time key.
      const vapidPublic = await getServerVapidPublicKey();
      if (currentPlayerIdRef.current !== playerId) return false;
      let sub = await reg.pushManager.getSubscription();

      if (sub && !sameApplicationServerKey(sub, vapidPublic)) {
        const old = sub.toJSON();
        // Remove the old database registration first, matching its exact keys.
        // If this fails, abort rather than leave an ambiguous server-side row.
        const removed = await fetch(`${API_BASE}/api/notifications/unsubscribe`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            playerId: playerId || "anonymous",
            p256dh: old.keys?.p256dh,
            auth: old.keys?.auth,
          }),
        });
        if (!removed.ok) throw new Error(`old subscription cleanup HTTP ${removed.status}`);
        await sub.unsubscribe();
        sub = null;
      }

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(vapidPublic),
        });
      }
      if (currentPlayerIdRef.current !== playerId) return false;

      const tzOffsetMinutes = -new Date().getTimezoneOffset();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
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
          origin: window.location.origin,
        }),
      });
      if (!res.ok) throw new Error(`subscription HTTP ${res.status}`);
      if (currentPlayerIdRef.current !== playerId) return false;
      try { localStorage.removeItem(DISABLED_KEY); } catch {}
      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error("[push] subscribe failed", e);
      setIsSubscribed(false);
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
      if (!sub || currentPlayerIdRef.current !== playerId) return false;
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
          const subJson = sub.toJSON();
          await fetch(`${API_BASE}/api/notifications/unsubscribe`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: sub.endpoint,
              playerId: playerId || "anonymous",
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth,
            }),
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
  const isSupported = "Notification" in window && "serviceWorker" in navigator;
  return { permission, isSubscribed, loading, subscribe, unsubscribe, isSupported, getPreferences, updatePreferences };
}
