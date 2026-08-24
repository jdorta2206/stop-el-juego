import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, lazy, Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { SplashScreen } from "@/components/SplashScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { usePlayer } from "@/hooks/use-player";
import { claimStripePack } from "@/lib/worldCupPack";
import Home from "@/pages/Home";
import SoloGame from "@/pages/SoloGame";
import Multiplayer from "@/pages/Multiplayer";
import Room from "@/pages/Room";
import Ranking from "@/pages/Ranking";
import NotFound from "@/pages/not-found";

// Lazy-loaded routes — keep initial bundle small for fast first paint on Android
const Privacy        = lazy(() => import("@/pages/Privacy"));
const Terms          = lazy(() => import("@/pages/Terms"));
const FAQ            = lazy(() => import("@/pages/FAQ"));
const About          = lazy(() => import("@/pages/About"));
const HowToPlay      = lazy(() => import("@/pages/HowToPlay"));
const DailyChallenge = lazy(() => import("@/pages/DailyChallenge"));
const Impossible     = lazy(() => import("@/pages/Impossible"));
const Friends        = lazy(() => import("@/pages/Friends"));
const Strategies     = lazy(() => import("@/pages/Strategies"));
const PlayerProfile  = lazy(() => import("@/pages/PlayerProfile"));
const Tienda         = lazy(() => import("@/pages/Tienda"));
const Tournament     = lazy(() => import("@/pages/Tournament"));
const Live           = lazy(() => import("@/pages/Live"));
const StreamerDirectory = lazy(() => import("@/pages/StreamerDirectory"));
const Overlay        = lazy(() => import("@/pages/Overlay"));
const DeleteAccount  = lazy(() => import("@/pages/DeleteAccount"));
const SeasonPass     = lazy(() => import("@/pages/SeasonPass"));
const Achievements   = lazy(() => import("@/pages/Achievements"));
const Collection     = lazy(() => import("@/pages/Collection"));
const Notifications  = lazy(() => import("@/pages/Notifications"));
const Blog           = lazy(() => import("@/pages/Blog"));
const BlogPost       = lazy(() => import("@/pages/BlogPost"));
// 🆕 Importar Contact (página de contacto)
const Contact        = lazy(() => import("@/pages/Contact"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function SoloRoute() {
  // Legacy/home links may still carry ?auto=1. The current game contract is
  // explicit: every new solo game must first show the Easy/Expert selector.
  // Strip the legacy auto-start flag before SoloGame renders so its mount
  // effect cannot bypass the lobby and start a round invisibly.
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") === "1") {
      params.delete("auto");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
  }
  return <SoloGame />;
}

function Router() {
  const [location] = useLocation();
  // SPA route change → enviar page_view a GA4 (directo) + dataLayer (GTM).
  useEffect(() => {
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    // GA4 directo (gtag.js)
    if (typeof w.gtag === "function") {
      w.gtag("event", "page_view", {
        page_path: location,
        page_title: document.title,
        page_location: window.location.href,
      });
    }
    // GTM (para Meta Pixel, TikTok Pixel u otros tags futuros)
    w.dataLayer.push({
      event: "page_view",
      page_path: location,
      page_title: document.title,
      page_location: window.location.href,
    });
  }, [location]);
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/solo" component={SoloRoute} />
      <Route path="/multiplayer" component={Multiplayer} />
      <Route path="/room/:id" component={Room} />
      <Route path="/live/:code" component={Live} />
      <Route path="/streamers" component={StreamerDirectory} />
      <Route path="/en-vivo" component={StreamerDirectory} />
      <Route path="/overlay/:code" component={Overlay} />
      <Route path="/ranking" component={Ranking} />
      {/* 🆕 Rutas legales y de información */}
      <Route path="/privacidad" component={Privacy} />
      <Route path="/terminos" component={Terms} />
      <Route path="/faq" component={FAQ} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/acerca" component={About} />
      <Route path="/como-jugar" component={HowToPlay} />
      <Route path="/reto" component={DailyChallenge} />
      <Route path="/imposible" component={Impossible} />
      <Route path="/impossible" component={Impossible} />
      <Route path="/amigos" component={Friends} />
      <Route path="/estrategias" component={Strategies} />
      <Route path="/player/:id" component={PlayerProfile} />
      <Route path="/tienda" component={Tienda} />
      <Route path="/shop" component={Tienda} />
      <Route path="/torneo" component={Tournament} />
      <Route path="/torneo/:code" component={Tournament} />
      <Route path="/season" component={SeasonPass} />
      <Route path="/logros" component={Achievements} />
      <Route path="/achievements" component={Achievements} />
      <Route path="/coleccion" component={Collection} />
      <Route path="/collection" component={Collection} />
      <Route path="/notificaciones" component={Notifications} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      {/* Google Play "Account deletion URL" requirement (es + en aliases) */}
      <Route path="/eliminar-cuenta" component={DeleteAccount} />
      <Route path="/delete-account" component={DeleteAccount} />
      {/* 🆕 Contacto */}
      <Route path="/contacto" component={Contact} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Handles the Stripe one-time pack return. Stripe redirects to
// `/?pack=success&session_id=...` (always the root, not the profile), so the
// claim must run app-wide. Grants the cosmetics server-side, then strips the
// query params so a refresh doesn't re-trigger it. The grant is idempotent.
function PackClaimHandler() {
  const { player } = usePlayer();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("pack") !== "success") return;
    const playerId = player?.id;
    if (!playerId) return; // wait until the player profile is loaded

    const sessionId = params.get("session_id") || undefined;
    let cancelled = false;
    (async () => {
      try {
        const r = await claimStripePack({ playerId, sessionId });
        if (!cancelled && r.granted) {
          window.alert("¡Pack Mundial desbloqueado! Ya tienes todos los cosméticos del Mundial. ⚽");
        }
      } catch {
        /* silent — the user can retry from the shop, grant is idempotent */
      } finally {
        // Strip pack params regardless so a refresh doesn't loop.
        const url = new URL(window.location.href);
        url.searchParams.delete("pack");
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url.toString());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player?.id]);
  return null;
}

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const lang = (localStorage.getItem("stop_lang") ?? "es") as string;

  // ── Hardware back button (TWA / Android). Three behaviors layered:
  //   1) If a modal/dropdown is open (data-modal-open="true"), close it.
  //   2) Else, if we're not at "/", navigate back to "/" (instead of letting
  //      the TWA exit straight from a deep page — common Play Store complaint).
  //   3) Else (already at "/"), let the OS exit normally.
  // We seed one dummy history entry per render-loop iteration so each press
  // hits this handler before the OS sees it.
  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const isAtHome = () => {
      const p = window.location.pathname.replace(base, "") || "/";
      return p === "/" || p === "";
    };
    try { window.history.pushState({ stopApp: true }, ""); } catch { /* ignore */ }
    const onPop = () => {
      const open = document.body.dataset.modalOpen;
      if (open === "true") {
        try {
          document.body.dataset.modalOpen = "false";
          window.dispatchEvent(new CustomEvent("stop:back"));
          window.history.pushState({ stopApp: true }, "");
        } catch { /* ignore */ }
        return;
      }
      if (!isAtHome()) {
        try {
          window.history.replaceState({ stopApp: true }, "", `${base}/`);
          window.dispatchEvent(new PopStateEvent("popstate"));
          window.history.pushState({ stopApp: true }, "");
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* reducedMotion="user" → respects OS-level "Reduce animations" toggle */}
      <MotionConfig reducedMotion="user">
        <ErrorBoundary>
          <PackClaimHandler />
          <SplashScreen onDone={() => setSplashDone(true)} lang={lang} />
          {splashDone && (
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Suspense fallback={
                <div
                  className="fixed inset-0 flex items-center justify-center pointer-events-none"
                  style={{ background: "#1a1a2e" }}
                  aria-label="Cargando"
                >
                  <div
                    className="w-12 h-12 rounded-full border-4 border-white/10 animate-spin"
                    style={{ borderTopColor: "#fbbf24" }}
                  />
                </div>
              }>
                <Router />
              </Suspense>
            </WouterRouter>
          )}
          <Toaster />
        </ErrorBoundary>
      </MotionConfig>
    </QueryClientProvider>
  );
}

export default App;
