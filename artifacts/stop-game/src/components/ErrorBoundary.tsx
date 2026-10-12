import { trackClientError } from "@/lib/analyticsClient";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const LAZY_DEFAULT_RECOVERY_KEY = "stop_lazy_default_boundary_recovery_once";

function isLazyDefaultImportFailure(error: Error | null): boolean {
  const message = error?.message || "";
  return /cannot read properties of undefined \(reading ['"]default['"]\)|undefined is not an object.*(?:_result\.default|\.default)|_result\.default/i.test(message);
}

/**
 * Catches uncaught render errors so a single bug in any page doesn't blank
 * the entire app for production users. Shows a recovery screen with a
 * "Reload" button for ordinary errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
    trackClientError(error, info.componentStack);

    // React.lazy can surface a stale/rejected module as an undefined
    // ".default" during rendering, before window-level chunk handlers can
    // recognize it. Recover automatically once per tab, but never loop.
    if (isLazyDefaultImportFailure(error)) {
      try {
        if (sessionStorage.getItem(LAZY_DEFAULT_RECOVERY_KEY) !== "1") {
          sessionStorage.setItem(LAZY_DEFAULT_RECOVERY_KEY, "1");
          void this.recoverAssetCacheAndReload();
        }
      } catch {
        // If session storage is unavailable, leave the recovery screen usable.
      }
    }
  }

  private recoverAssetCacheAndReload = async () => {
    // Clear only app asset caches. Keep the service worker registered so
    // push notifications continue working; preserve DATA_CACHE and game data.
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("stop-v"))
          .map((key) => caches.delete(key))
      );
    } catch {
      // Cache APIs may be unavailable; still try a fresh document.
    }
    window.location.reload();
  };

  private handleReload = () => {
    // Manual recovery is available for any other render error.
    void (async () => {
      try {
        const registrations = await navigator.serviceWorker?.getRegistrations?.() || [];
        await Promise.all(registrations.map((registration) => registration.unregister()));
      } catch {
        // Best effort: recovery must not be blocked by service-worker APIs.
      }

      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith("stop-v"))
            .map((key) => caches.delete(key))
        );
      } catch {
        // Cache APIs may be unavailable; still retry a fresh document.
      }

      try {
        sessionStorage.removeItem("stop_chunk_recovery_once");
      } catch {
        // Storage can be unavailable in restricted webviews.
      }

      window.location.reload();
    })();
  };

  private handleGoHome = () => {
    try {
      window.location.href = "/";
    } catch { /* ignore */ }
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "linear-gradient(180deg, #060318 0%, #1a0a2e 100%)",
            color: "white",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textAlign: "center",
          }}
          role="alert"
          aria-live="assertive"
        >
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎮</div>
          <h1 style={{ fontSize: "24px", fontWeight: 900, marginBottom: "8px", color: "#f9a825" }}>
            ¡Algo salió mal!
          </h1>
          <p style={{ fontSize: "14px", opacity: 0.8, maxWidth: "320px", marginBottom: "24px", lineHeight: 1.5 }}>
            Se produjo un error inesperado. Recarga el juego para volver a jugar — tu progreso está guardado.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: "12px 24px",
                background: "#b5301a",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontWeight: 800,
                fontSize: "15px",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(181,48,26,0.4)",
              }}
            >
              Recargar
            </button>
            <button
              onClick={this.handleGoHome}
              style={{
                padding: "12px 24px",
                background: "transparent",
                color: "white",
                border: "2px solid rgba(255,255,255,0.2)",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "15px",
                cursor: "pointer",
              }}
            >
              Ir al inicio
            </button>
          </div>
          {isDev && this.state.error && (
            <pre
              style={{
                marginTop: "32px",
                padding: "16px",
                background: "rgba(0,0,0,0.4)",
                borderRadius: "8px",
                maxWidth: "90vw",
                maxHeight: "200px",
                overflow: "auto",
                textAlign: "left",
                fontSize: "11px",
                color: "#ff6b6b",
              }}
            >
              {this.state.error.stack || this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
