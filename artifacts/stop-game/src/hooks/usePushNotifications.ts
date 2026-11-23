import { useState, useEffect, useCallback, useRef } from "react";
import { getApiUrl, authHeaders } from "@/lib/utils";
import { runSingleFlight, waitForPermissionResult } from "@/lib/pushSubscriptionFlow";

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
export type PushActivationError =
  | "permission-request-failed"
  | "permission-not-granted"
  | "vapid-key-unavailable"
  | "service-worker-unavailable"
  | "push-subscription-failed"
  | "subscription-registration-failed"
  | "unknown";

class PushActivationFailure extends Error {
  constructor(readonly code: PushActivationError, message: string) {
    super(message);
    this.name = "PushActivationFailure";
  }
}

export function usePushNotifications(playerId: string | undefined, language: string) {
  const [permission, setPermission] = useState<NotifPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentPlayerIdRef = useRef(playerId);
  const preferencesAbortRef = useRef<AbortController | null>(null);
  const subscribeOperationRef = useRef<Promise<boolean> | null>(null);
  const [permissionWaiting, setPermissionWaiting] = useState(false);
  const [activationError, setActivationError] = useState<PushActivationError | null>(null);
  const activationErrorRef = useRef<PushActivationError | null>(null);
  currentPlayerIdRef.current = playerId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const controller = new AbortController();
    const initialise = async () => {
      try {
        if (!("Notification" in window) || !("serviceWorker" in navigator)) {
          if (!cancelled) setPermission("unsupported");
          return;
        }

        const perm = Notification.permission as NotifPermission;
        if (!cancelled) setPermission(perm);

        const reg = await withTimeout(navigator.serviceWorker.ready, 12000, "Service worker is not ready");
        if (cancelled) return;

        let sub = await withTimeout(reg.pushManager.getSubscription(), 10000, "Could not read push subscription");
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
            // Match the explicit activation path: a 503 means this server
            // cannot store the endpoint, so do not leave a local-only sub.
            if (res.status === 503) {
              try { await sub.unsubscribe(); } catch {}
            }
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void initialise();
    return () => { cancelled = true; controller.abort(); };
  }, [playerId, language]);

  const registerSubscription = useCallback(async (): Promise<boolean> => {
    const vapidPublicKey = await getServerVapidPublicKey();
    if (!vapidPublicKey) throw new PushActivationFailure("vapid-key-unavailable", "Server VAPID public key is unavailable");
    let reg: ServiceWorkerRegistration;
    try { reg = await withTimeout(navigator.serviceWorker.ready, 12000, "Service worker is not ready"); }
    catch { throw new PushActivationFailure("service-worker-unavailable", "Service worker is not ready"); }

    let existing: PushSubscription | null;
    try { existing = await withTimeout(reg.pushManager.getSubscription(), 10000, "Could not read push subscription"); }
    catch { throw new PushActivationFailure("push-subscription-failed", "Could not inspect push subscription"); }
    if (currentPlayerIdRef.current !== playerId) return false;
    // A persisted subscription created with a previous VAPID key cannot receive
    // pushes signed by the server current key. Recreate it before registering.
    if (existing && !subscriptionMatchesVapidKey(existing, vapidPublicKey)) {
      try { await existing.unsubscribe(); }
      catch { throw new PushActivationFailure("push-subscription-failed", "Could not replace stale push subscription"); }
      existing = null;
    }
    let sub: PushSubscription;
    try {
      sub = existing || await withTimeout(reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vapidPublicKey),
      }), 12000, "Push subscription timed out");
    } catch {
      throw new PushActivationFailure("push-subscription-failed", "Browser push subscription could not be created");
    }

    const tzOffsetMinutes = -new Date().getTimezoneOffset();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    let res: Response;
    try {
      res = await withTimeout(fetch(`${API_BASE}/api/notifications/subscribe`, {
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
    } catch {
      throw new PushActivationFailure("subscription-registration-failed", "Subscription registration request failed");
    }

    if (!res.ok) {
      // A 503 means this server instance cannot accept the subscription.
      // Remove the browser-side endpoint so it is not left looking active
      // without a corresponding server record; the user can retry later.
      if (res.status === 503) {
        try { await sub.unsubscribe(); } catch {}
      }
      throw new PushActivationFailure("subscription-registration-failed", `Subscription registration HTTP ${res.status}`);
    }
    if (currentPlayerIdRef.current !== playerId) return false;
    try { localStorage.removeItem(DISABLED_KEY); } catch {}
    setIsSubscribed(true);
    return true;
  }, [playerId, language]);

  const subscribe = useCallback((): Promise<boolean> => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setActivationError("service-worker-unavailable");
      activationErrorRef.current = "service-worker-unavailable";
      return Promise.resolve(false);
    }

    return runSingleFlight(
      () => subscribeOperationRef.current,
      (operation) => { subscribeOperationRef.current = operation; },
      async () => {
        setLoading(true);
        setPermissionWaiting(false);
        setActivationError(null);
        activationErrorRef.current = null;
        try {
          // Call synchronously from the click handler to preserve Android's user activation.
          let permissionRequest: Promise<NotificationPermission>;
          try {
            permissionRequest = Notification.requestPermission();
          } catch {
            throw new PushActivationFailure("permission-request-failed", "Permission prompt could not be opened");
          }

          let perm: NotificationPermission;
          try {
            perm = await waitForPermissionResult(
              permissionRequest,
              () => setPermissionWaiting(true),
              15000,
            );
          } catch {
            throw new PushActivationFailure("permission-request-failed", "Permission request failed");
          }

          if (currentPlayerIdRef.current !== playerId) return false;
          setPermission(perm as NotifPermission);
          if (perm !== "granted") {
            throw new PushActivationFailure("permission-not-granted", "Notification permission was not granted");
          }

          return await registerSubscription();
        } catch (e) {
          const code: PushActivationError = e instanceof PushActivationFailure ? e.code : "unknown";
          setActivationError(code);
          activationErrorRef.current = code;
          // Log only the safe failure category; never log endpoints, keys or player identifiers.
          console.warn("[push] activation failed", code);
          return false;
        } finally {
          setPermissionWaiting(false);
          setLoading(false);
        }
      },
    );
  }, [playerId, registerSubscription]);

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

  return { permission, isSubscribed, loading, permissionWaiting, activationError, getActivationError: () => activationErrorRef.current, subscribe, unsubscribe, isSupported, getPreferences, updatePreferences };
}
