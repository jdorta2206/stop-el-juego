import { useEffect, useState } from "react";
import { Gamepad2, CheckCircle2, Loader2 } from "lucide-react";
import {
  getLastPlayGamesStatus,
  requestPlayGamesSignIn,
} from "@/lib/twaPlayGamesBridge";
import { useT } from "@/i18n/useT";

type PlayGamesStatus = { ok: boolean; status: string };

const SESSION_KEY = "stop_pgs_connect_banner_seen_v1";
const MAX_VISIBLE_MS = 3800;
const CONNECTED_VISIBLE_MS = 2200;

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
    <div className="mx-auto mb-4 w-full max-w-md px-4" role="status" aria-live="polite">
      <div
        className="relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-white shadow-[0_12px_36px_rgba(0,0,0,.32)]"
        style={{
          background: "linear-gradient(115deg, rgba(13,20,38,.98), rgba(25,32,55,.96) 58%, rgba(20,54,48,.96))",
          borderColor: connected ? "rgba(74,222,128,.42)" : "rgba(255,255,255,.16)",
        }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[.08] shadow-inner"
          aria-hidden="true"
        >
          <Gamepad2 className="h-7 w-7 text-emerald-300" strokeWidth={2.1} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[.18em] text-white/65">
              Google Play Juegos
            </span>
            {connected && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />}
          </div>
          <p className="text-sm font-bold leading-snug text-white">
            {connected
              ? t.playGamesBanner.connected
              : connecting
                ? t.playGamesBanner.connecting
                : t.playGamesBanner.failed}
          </p>
        </div>

        {!connected && connecting && (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-emerald-300 motion-reduce:animate-none" aria-hidden="true" />
        )}

        {!connected && !connecting && (
          <button
            type="button"
            className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/15"
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
          className="ml-0.5 shrink-0 rounded-lg px-1.5 py-2 text-xs font-semibold text-white/55 hover:text-white"
          aria-label={t.playGamesBanner.continue}
          onClick={() => setVisible(false)}
        >
          {t.playGamesBanner.continue}
        </button>
      </div>
    </div>
  );
}
