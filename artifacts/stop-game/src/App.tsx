import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, lazy, Suspense, type ComponentType } from "react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { SplashScreen } from "@/components/SplashScreen";
import { PlayUpdateBanner } from "@/components/PlayUpdateBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { usePlayer } from "@/hooks/use-player";
import { claimStripePack } from "@/lib/worldCupPack";
import { notifyPlayGamesStartupReady } from "@/lib/twaPlayGamesBridge";
import { flushScoreOutbox } from "@/lib/offlineGame";
import { getApiUrl, authHeaders } from "@/lib/utils";
import Home from "@/pages/Home";
import SoloGame from "@/pages/SoloGame";
import Multiplayer from "@/pages/Multiplayer";
import Room from "@/pages/Room";
import Ranking from "@/pages/Ranking";
import NotFound from "@/pages/not-found";

// A successful lazy import proves that the current page bundle can load.
// Reset both one-shot guards then, so a later deployment/chunk failure in the
// same tab can recover too instead of leaving the player on the error screen.
const CHUNK_RECOVERY_KEYS = [
  "stop_chunk_recovery_once",
  "stop_lazy_default_boundary_recovery_once",
] as const;

function lazyPage<T extends { default: ComponentType<any> }>(load: () => Promise<T>) {
  return lazy(async () => {
    const module = await load();
    if (!module?.default) throw new Error("lazy-module-missing-default");
    try {
      for (const key of CHUNK_RECOVERY_KEYS) sessionStorage.removeItem(key);
    } catch {
      // Recovery guards are best-effort in restricted browser storage.
    }
    return module;
  });
}

const Privacy = lazyPage(() => import("@/pages/Privacy"));
const Terms = lazyPage(() => import("@/pages/Terms"));
const FAQ = lazyPage(() => import("@/pages/FAQ"));
const About = lazyPage(() => import("@/pages/About"));
const HowToPlay = lazyPage(() => import("@/pages/HowToPlay"));
const ComoFunciona = lazyPage(() => import("@/pages/ComoFunciona"));
const DailyChallenge = lazyPage(() => import("@/pages/DailyChallenge"));
const Impossible = lazyPage(() => import("@/pages/Impossible"));
const Friends = lazyPage(() => import("@/pages/Friends"));
const Strategies = lazyPage(() => import("@/pages/Strategies"));
const PlayerProfile = lazyPage(() => import("@/pages/PlayerProfile"));
const Tienda = lazyPage(() => import("@/pages/Tienda"));
const Tournament = lazyPage(() => import("@/pages/Tournament"));
const Live = lazyPage(() => import("@/pages/Live"));
const StreamerDirectory = lazyPage(() => import("@/pages/StreamerDirectory"));
const Overlay = lazyPage(() => import("@/pages/Overlay"));
const DeleteAccount = lazyPage(() => import("@/pages/DeleteAccount"));
const SeasonPass = lazyPage(() => import("@/pages/SeasonPass"));
const Achievements = lazyPage(() => import("@/pages/Achievements"));
const Collection = lazyPage(() => import("@/pages/Collection"));
const Notifications = lazyPage(() => import("@/pages/Notifications"));
const Blog = lazyPage(() => import("@/pages/Blog"));
const BlogPost = lazyPage(() => import("@/pages/BlogPost"));
const Contact = lazyPage(() => import("@/pages/Contact"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function Router() {
  const [location] = useLocation();
  useEffect(() => {
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    if (typeof w.gtag === "function") {
      w.gtag("event", "page_view", {
        page_path: location,
        page_title: document.title,
        page_location: window.location.href,
      });
    }
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
      <Route path="/solo" component={SoloGame} />
      <Route path="/multiplayer" component={Multiplayer} />
      <Route path="/room/:id" component={Room} />
      <Route path="/live/:code" component={Live} />
      <Route path="/streamers" component={StreamerDirectory} />
      <Route path="/en-vivo" component={StreamerDirectory} />
      <Route path="/overlay/:code" component={Overlay} />
      <Route path="/ranking" component={Ranking} />
      <Route path="/privacidad" component={Privacy} />
      <Route path="/terminos" component={Terms} />
      <Route path="/faq" component={FAQ} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/acerca" component={About} />
      <Route path="/como-jugar" component={HowToPlay} />
      <Route path="/como-funciona" component={ComoFunciona} />
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
      <Route path="/eliminar-cuenta" component={DeleteAccount} />
      <Route path="/delete-account" component={DeleteAccount} />
      <Route path="/contacto" component={Contact} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PackClaimHandler() {
  const { player } = usePlayer();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("pack") !== "success") return;
    const playerId = player?.id;
    if (!playerId) return;

    const sessionId = params.get("session_id") || undefined;
    let cancelled = false;
    (async () => {
      try {
        const r = await claimStripePack({ playerId, sessionId });
        if (!cancelled && r.granted) {
          window.alert("¡Pack Mundial desbloqueado! Ya tienes todos los cosméticos del Mundial. ⚽");
        }
      } catch {
        // The claim is idempotent; keep the UI usable if the request fails.
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete("pack");
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url.toString());
      }
    })();
    return () => { cancelled = true; };
  }, [player?.id]);
  return null;
}

function ScoreOutboxHandler() {
  const { player } = usePlayer();

  useEffect(() => {
    const tryFlush = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (!player?.id) return;
      void flushScoreOutbox(async (payload) => {
        const response = await fetch(getApiUrl() + "/api/ranking/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("score-sync-" + response.status);
        return response.json();
      }, player.id);
    };

    tryFlush();
    window.addEventListener("online", tryFlush);
    return () => window.removeEventListener("online", tryFlush);
  }, [player?.id]);

  return null;
}

function App() {

  // Production prerender puts SEO HTML inside #root. Reveal it only after
  // React has committed the real application, preventing a raw-HTML flash.
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root) root.style.visibility = "visible";
  }, []);
  const lang = (localStorage.getItem("stop_lang") ?? "es") as string;

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const isAtHome = () => {
      const p = window.location.pathname.replace(base, "") || "/";
      return p === "/" || p === "";
    };
    try { window.history.pushState({ stopApp: true }, ""); } catch {}
    const onPop = () => {
      const open = document.body.dataset.modalOpen;
      if (open === "true") {
        try {
          document.body.dataset.modalOpen = "false";
          window.dispatchEvent(new CustomEvent("stop:back"));
          window.history.pushState({ stopApp: true }, "");
        } catch {}
        return;
      }
      if (!isAtHome()) {
        try {
          window.history.replaceState({ stopApp: true }, "", `${base}/`);
          window.dispatchEvent(new PopStateEvent("popstate"));
          window.history.pushState({ stopApp: true }, "");
        } catch {}
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <ErrorBoundary>
          <PackClaimHandler />
          <ScoreOutboxHandler />
          <SplashScreen
            onDone={() => {
              // Let React remove the splash and paint the first game frame before
              // Android opens the Google Play Games welcome/authentication UI.
              requestAnimationFrame(() => requestAnimationFrame(() => {
                notifyPlayGamesStartupReady();
              }));
            }}
            lang={lang}
          />
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
          <PlayUpdateBanner />
          <Toaster />
        </ErrorBoundary>
      </MotionConfig>
    </QueryClientProvider>
  );
}

export default App;
