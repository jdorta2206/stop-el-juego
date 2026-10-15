import { useEffect, useState } from "react";
import {
  getLastPlayGamesStatus,
  requestPlayGamesSignIn,
} from "@/lib/twaPlayGamesBridge";
import { useT } from "@/i18n/useT";

type PlayGamesStatus = { ok: boolean; status: string };

const SESSION_KEY = "stop_pgs_connect_banner_seen_v1";
const MAX_VISIBLE_MS = 2800;
const CONNECTED_VISIBLE_MS = 1500;

const WEB_ONLY_STATUSES = new Set([
  "conectando",
  "sign_in_in_progress",
  "sin_respuesta",
  "puente_no_disponible",
]);

function hasExplicitTwaMarkerAtStartup(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const params = new URLSearchParams(window.location.search);

    return (
      params.get("source") === "googleplay-twa" ||
      params.get("source") === "twa" ||
      document.referrer.startsWith(
        "android-app://app.replit.stop_el_juego.twa"
      )
    );
  } catch {
    return false;
  }
}

// Capture the marker before SPA navigation can remove the launch parameters.
const IS_MARKED_TWA_AT_STARTUP = hasExplicitTwaMarkerAtStartup();
let shownThisModule = false;

function isNativeStatus(
  status: PlayGamesStatus | null
): status is PlayGamesStatus {
  return (
    !!status &&
    typeof status.ok === "boolean" &&
    typeof status.status === "string" &&
    !WEB_ONLY_STATUSES.has(status.status)
  );
}

export function PlayGamesConnectBanner() {
  const { t } = useT();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<PlayGamesStatus>({
    ok: false,
    status: "conectando",
  });

  useEffect(() => {
    if (!IS_MARKED_TWA_AT_STARTUP || shownThisModule) return;

    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Continue without session persistence if storage is unavailable.
    }

    shownThisModule = true;

    const deadline = Date.now() + MAX_VISIBLE_MS;
    let hideTimer: ReturnType<typeof setTimeout>;
    let disposed = false;

    const hide = () => {
      if (!disposed) setVisible(false);
    };

    const scheduleHide = (delay: number) => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, Math.max(0, delay));
    };

    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<PlayGamesStatus>).detail;

      // Ignore synthetic/web statuses, including sign_in_in_progress.
      if (!isNativeStatus(detail)) return;

      const remaining = deadline - Date.now();

      if (remaining <= 0) {
        hide();
        return;
      }

      setStatus(detail);

      if (detail.ok === true && detail.status === "authenticated") {
        scheduleHide(Math.min(CONNECTED_VISIBLE_MS, remaining));
      }
    };

    window.addEventListener("stop:play-games-status", onStatus);
    setVisible(true);
    scheduleHide(MAX_VISIBLE_MS);

    const lastStatus = getLastPlayGamesStatus();

    if (isNativeStatus(lastStatus)) {
      onStatus(
        new CustomEvent("stop:play-games-status", {
          detail: lastStatus,
        })
      );
    }

    return () => {
      disposed = true;
      clearTimeout(hideTimer);
      window.removeEventListener("stop:play-games-status", onStatus);
    };
  }, []);

  if (!IS_MARKED_TWA_AT_STARTUP || !visible) return null;

  const connected =
    status.ok === true && status.status === "authenticated";

  const connecting =
    status.status === "conectando" ||
    status.status === "sign_in_in_progress";

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[120]">
      <div
        className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-xl border border-white/15 bg-slate-950/95 p-3 text-white shadow-xl"
        role="status"
        aria-live="polite"
      >
        {!connected && connecting && (
          <span
            aria-hidden="true"
            className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none"
          />
        )}

        <p className="min-w-0 flex-1 text-sm">
          {connected
            ? t.playGamesBanner.connected
            : connecting
              ? t.playGamesBanner.connecting
              : t.playGamesBanner.failed}
        </p>

        {!connected && (
          <button
            type="button"
            className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold"
            onClick={() => {
              setStatus({ ok: false, status: "conectando" });
              requestPlayGamesSignIn();
            }}
          >
            {t.playGamesBanner.retry}
          </button>
        )}

        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-2 text-sm"
          aria-label={t.playGamesBanner.continue}
          onClick={() => setVisible(false)}
        >
          {t.playGamesBanner.continue}
        </button>
      </div>
    </div>
  );
}
