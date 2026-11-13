import { useState, useEffect, useCallback, useRef } from "react";
import { getApiUrl, authHeaders } from "@/lib/utils";

const API_BASE = getApiUrl();
const DISABLED_KEY = "stop_push_notifications_disabled";

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function getServerVapidPublicKey(): Promise<string | null> {
  try {
    const response = await withTimeout(fetch(`${API_BASE}/api/notifications/vapid-public-key`, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
    }), 10000, "VAPID request timed out");
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data?.key === "string" && data.key.trim() ? data.key.trim() : null;
  } catch {
    // If the server key cannot be retrieved, do not subscribe with a possibly
    // stale build-time key: Web Push endpoints are bound to the VAPID key pair.
    return null;
  }
}

function urlB64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))) as Uint8Array<ArrayBuffer>;
}

function subscriptionMatchesVapidKey(subscription: PushSubscription, publicKey: string): boolean {
  const currentKey = subscription.options.applicationServerKey;
  if (!currentKey) return false;
  const current = new Uint8Array(currentKey);
  const expected = urlB64ToUint8Array(publicKey);
  return current.length === expected.length && current.every((value, index) => value === expected[index]);
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

        let sub = await reg.pushManager.getSubscription();
        if (cancelled) return;

        if (!sub) {
          // Without a browser PushSubscription there is nothing the server can deliver to.
          setIsSubscribed(false);
          return;
        }

        // Respect an explicit opt-out even if the browser failed to remove its
        // local subscription during the previous unsubscribe attempt.
        let locallyDisabled = false;
        try { locallyDisabled = localStorage.getItem(DISABLED_KEY) === "1"; } catch {}
        if (locallyDisabled) {
          setIsSubscribed(false);
          return;
        }

        // A browser subscription is not necessarily usable by this server:
        // Push endpoints are bound to the VAPID key used when they were created.
        if (perm !== "granted" || currentPlayerIdRef.current !== playerId) {
          setIsSubscribed(false);
          return;
        }

        const vapidPublicKey = await withTimeout(getServerVapidPublicKey(), 12000, "VAPID key request timed out");
        if (cancelled || currentPlayerIdRef.current !== playerId) return;
        if (!vapidPublicKey) {
          console.warn("[push] server VAPID key unavailable; subscription is not confirmed");
          setIsSubscribed(false);
          return;
        }

        if (!subscriptionMatchesVapidKey(sub, vapidPublicKey)) {
          // Permission is already granted. Replace only after obtaining the
          // current server key, then register the new endpoint below.
          await sub.unsubscribe();
          if (cancelled || currentPlayerIdRef.current !== playerId) return;
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(vapidPublicKey),
          });
        }

        const tzOffsetMinutes = -new Date().getTimezoneOffset();
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
        try {
          if (currentPlayerIdRef.current !== playerId) return;
          const res = await withTimeout(fetch(`${API_BASE}/api/notifications/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            credentials: "include",
            signal: controller.signal,
            body: JSON.stringify({
              playerId: playerId || "anonymous",
              subscription: sub.toJSON(),
              language,
              tzOffsetMinutes,
              timeZone,
              origin: window.location.origin,
            }),
          }), 12000, "Subscription backfill timed out");
          if (!res.ok) {
            console.warn("[push] subscription backfill failed", res.status);
            if (!cancelled) setIsSubscribed(false);
            return;
          }
          if (!cancelled && currentPlayerIdRef.current === playerId) {
            try { localStorage.removeItem(DISABLED_KEY); } catch {}
            setIsSubscribed(true);
          }
        } catch (e) {
          console.warn("[push] subscription backfill error", e);
          if (!cancelled) setIsSubscribed(false);
        }
      } catch (e) {
        console.warn("[push] initialise error", e);
      }
    };

    void initialise();
    return () => { cancelled = true; controller.abort(); };
  }, [playerId, language]);

  const subscribe = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
    setLoading(true);
    try {
      // Request permission immediately while the click's transient user
      // activation is still available. Network and service-worker awaits can
      // otherwise consume that activation and cause Chrome/Android to ignore
      // or reject the permission prompt.
      // Some Android WebView/TWA permission prompts may leave this Promise pending.
      // Bound the wait so the activation control never remains disabled forever.
      const permissionRequest = Notification.requestPermission();
      const perm = await withTimeout(
        permissionRequest,
        15000,
        "Notification permission request timed out",
      );
      setPermission(perm as NotifPermission);
      if (perm !== "granted") return false;

      // Only perform network/service-worker work after the browser permission
      // decision has been made.
      const vapidPublicKey = await getServerVapidPublicKey();
      if (!vapidPublicKey) throw new Error("Server VAPID public key is unavailable");
      const reg = await withTimeout(navigator.serviceWorker.ready, 12000, "Service worker is not ready");

      let existing = await withTimeout(reg.pushManager.getSubscription(), 10000, "Could not read push subscription");
      if (currentPlayerIdRef.current !== playerId) return false;
      // A persisted subscription created with a previous VAPID key cannot receive
      // pushes signed by the server current key. Recreate it before registering.
      if (existing && !subscriptionMatchesVapidKey(existing, vapidPublicKey)) {
        await existing.unsubscribe();
        existing = null;
      }
      const sub = existing || await withTimeout(reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vapidPublicKey),
      }), 12000, "Push subscription timed out");

      const tzOffsetMinutes = -new Date().getTimezoneOffset();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
      const res = await withTimeout(fetch(`${API_BASE}/api/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({
          playerId: playerId || "anonymous",
          subscription: sub.toJSON(),
          language,
          hourLocal: 20,
          tzOffsetMinutes,
          timeZone,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      }), 12000, "Subscription registration timed out");

      if (!res.ok) throw new Error(`subscription HTTP ${res.status}`);
      if (currentPlayerIdRef.current !== playerId) return false;
      try { localStorage.removeItem(DISABLED_KEY); } catch {}
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
        { signal: controller.signal, credentials: "include", headers: authHeaders() },
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
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ endpoint: sub.endpoint, playerId: playerId || "anonymous", ...patch }),
      });
      return res.ok;
    } catch { return false; }
  }, [playerId]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator)) return false;
    setLoading(true);
    try {
      const reg = await withTimeout(navigator.serviceWorker.ready, 12000, "Service worker is not ready");
      const sub = await withTimeout(reg.pushManager.getSubscription(), 10000, "Could not read push subscription");
      try { localStorage.setItem(DISABLED_KEY, "1"); } catch {}

      if (sub) {
        if (currentPlayerIdRef.current !== playerId) return false;
        try {
          const response = await withTimeout(fetch(`${API_BASE}/api/notifications/unsubscribe`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            credentials: "include",
            body: JSON.stringify({ endpoint: sub.endpoint, playerId: playerId || "anonymous" }),
          }), 12000, "Unsubscribe request timed out");
          if (!response.ok) {
            console.warn("[push] unsubscribe server cleanup failed", response.status);
          }
        } catch (e) {
          console.warn("[push] unsubscribe server request failed", e);
        }
        const removedLocally = await withTimeout(sub.unsubscribe(), 12000, "Could not remove push subscription");
        if (!removedLocally) return false;
      }
      setIsSubscribed(false);
      return true;
    } catch (e) {
      console.error("Push unsubscribe error:", e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => () => preferencesAbortRef.current?.abort(), [playerId]);

  const isSupported = "Notification" in window && "serviceWorker" in navigator;

  return { permission, isSubscribed, loading, subscribe, unsubscribe, isSupported, getPreferences, updatePreferences };
}
