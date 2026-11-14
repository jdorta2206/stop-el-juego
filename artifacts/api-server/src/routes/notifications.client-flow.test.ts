import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const readClientSource = (path: string) =>
  readFileSync(resolve(currentDir, "../../../stop-game/src", path), "utf8");

const appSource = readClientSource("App.tsx");
const soloGameSource = readClientSource("pages/SoloGame.tsx");
const celebrationSource = readClientSource("components/FirstVictoryCelebration.tsx");
const hookSource = readClientSource("hooks/usePushNotifications.ts");
const notificationsPageSource = readClientSource("pages/Notifications.tsx");

describe("first-victory push subscription recovery", () => {
  it("keeps the repair CTA available when permission is already granted", () => {
    expect(celebrationSource).toContain('Notification.permission !== "denied"');
    expect(celebrationSource).toContain("!!onEnableNotifications");
    expect(celebrationSource).not.toContain("notificationsAlreadyGranted");
  });

  it("routes the CTA through the complete notifications page, which is registered", () => {
    expect(soloGameSource).toContain('setLocation("/notifications")');
    expect(appSource).toContain('<Route path="/notifications" component={Notifications} />');
    expect(notificationsPageSource).toContain("usePushNotifications(player?.id, lang)");
  });
});

describe("push subscription initialization safeguards", () => {
  it("provides an initialization label in all four supported locales", () => {
    expect(notificationsPageSource).toContain('checking: "Comprobando suscripción…"');
    expect(notificationsPageSource).toContain('checking: "Checking subscription…"');
    expect(notificationsPageSource).toContain('checking: "A verificar a subscrição…"');
    expect(notificationsPageSource).toContain('checking: "Vérification de l’abonnement…"');
  });

  it("keeps the settings action disabled until initial subscription inspection finishes", () => {
    expect(hookSource).toContain("const [loading, setLoading] = useState(true)");
    expect(hookSource).toContain("setLoading(true);");
    expect(hookSource).toContain("finally {\n        if (!cancelled) setLoading(false);");
    expect(notificationsPageSource).toContain("{permissionWaiting ? t.waiting : loading ? t.checking : isSubscribed ? t.disableBtn : t.enableBtn}");
  });

  it("bounds service-worker and existing-subscription initialization waits", () => {
    expect(hookSource).toContain('withTimeout(navigator.serviceWorker.ready, 12000, "Service worker is not ready")');
    expect(hookSource).toContain('withTimeout(reg.pushManager.getSubscription(), 10000, "Could not read push subscription")');
    expect(hookSource).toContain("if (!sub) {");
    expect(hookSource).toContain("setIsSubscribed(false);");
  });

  it("replaces subscriptions created with a different server VAPID key before backfilling", () => {
    expect(hookSource).toContain("subscriptionMatchesVapidKey(sub, vapidPublicKey)");
    expect(hookSource).toContain("await sub.unsubscribe()");
    expect(hookSource).toContain("reg.pushManager.subscribe({");
    expect(hookSource).toContain("/api/notifications/subscribe");
  });

  it("keeps Android permission requests single-flight and waits for the real result", () => {
    expect(hookSource).toContain("runSingleFlight(");
    expect(hookSource).toContain("waitForPermissionResult(");
    expect(hookSource).toContain("Notification.requestPermission()");
    expect(hookSource).not.toContain("withTimeout(\n        permissionRequest");
    expect(notificationsPageSource).toContain("permissionWaiting ? t.waiting");
  });
});
