import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches uncaught render errors so a single bug in any page doesn't blank
 * the entire app for production users. Shows a recovery screen with a
 * "Reload" button and (in dev) the stack trace.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console for dev visibility; in prod this also surfaces in Sentry/Adsterra logs.
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  private handleReload = () => {
    try {
      this.setState({ hasError: false, error: null });
      window.location.reload();
    } catch {
      // ignore — page reload should still work even if state update fails
    }
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
