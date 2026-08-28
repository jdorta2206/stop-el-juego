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

const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const About = lazy(() => import("@/pages/About"));
const HowToPlay = lazy(() => import("@/pages/HowToPlay"));
const DailyChallenge = lazy(() => import("@/pages/DailyChallenge"));
const Impossible = lazy(() => import("@/pages/Impossible"));
const Friends = lazy(() => import("@/pages/Friends"));
const Strategies = lazy(() => import("@/pages/Strategies"));
const PlayerProfile = lazy(() => import("@/pages/PlayerProfile"));
const Tienda = lazy(() => import("@/pages/Tienda"));
const Tournament = lazy(() => import("@/pages/Tournament"));
const Live = lazy(() => import("@/pages/Live"));
const StreamerDirectory = lazy(() => import("@/pages/StreamerDirectory"));
const Overlay = lazy(() => import("@/pages/Overlay"));
const DeleteAccount = lazy(() => import("@/pages/DeleteAccount"));
const SeasonPass = lazy(() => import("@/pages/SeasonPass"));
const Achievements = lazy(() => import("@/pages/Achievements"));
const Collection = lazy(() => import("@/pages/Collection"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const Contact = lazy(() => import("@/pages/Contact"));

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

function App() {
  const [splashDone, setSplashDone] = useState(false);
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
