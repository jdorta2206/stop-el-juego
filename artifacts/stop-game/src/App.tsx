import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, lazy, Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { SplashScreen } from "@/components/SplashScreen";
import Home from "@/pages/Home";
import SoloGame from "@/pages/SoloGame";
import Multiplayer from "@/pages/Multiplayer";
import Room from "@/pages/Room";
import Ranking from "@/pages/Ranking";
import NotFound from "@/pages/not-found";

// Lazy-loaded routes — keep initial bundle small for fast first paint on Android
const Privacy        = lazy(() => import("@/pages/Privacy"));
const Terms          = lazy(() => import("@/pages/Terms"));
const About          = lazy(() => import("@/pages/About"));
const HowToPlay      = lazy(() => import("@/pages/HowToPlay"));
const DailyChallenge = lazy(() => import("@/pages/DailyChallenge"));
const Friends        = lazy(() => import("@/pages/Friends"));
const Strategies     = lazy(() => import("@/pages/Strategies"));
const PlayerProfile  = lazy(() => import("@/pages/PlayerProfile"));
const Tournament     = lazy(() => import("@/pages/Tournament"));
const Live           = lazy(() => import("@/pages/Live"));
const Overlay        = lazy(() => import("@/pages/Overlay"));
const DeleteAccount  = lazy(() => import("@/pages/DeleteAccount"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/solo" component={SoloGame} />
      <Route path="/multiplayer" component={Multiplayer} />
      <Route path="/room/:id" component={Room} />
      <Route path="/live/:code" component={Live} />
      <Route path="/overlay/:code" component={Overlay} />
      <Route path="/ranking" component={Ranking} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/acerca" component={About} />
      <Route path="/como-jugar" component={HowToPlay} />
      <Route path="/reto" component={DailyChallenge} />
      <Route path="/amigos" component={Friends} />
      <Route path="/estrategias" component={Strategies} />
      <Route path="/player/:id" component={PlayerProfile} />
      <Route path="/torneo" component={Tournament} />
      <Route path="/torneo/:code" component={Tournament} />
      {/* Google Play "Account deletion URL" requirement (es + en aliases) */}
      <Route path="/eliminar-cuenta" component={DeleteAccount} />
      <Route path="/delete-account" component={DeleteAccount} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const lang = (localStorage.getItem("stop_lang") ?? "es") as string;

  return (
    <QueryClientProvider client={queryClient}>
      {/* reducedMotion="user" → respects OS-level "Reduce animations" toggle */}
      <MotionConfig reducedMotion="user">
        <SplashScreen onDone={() => setSplashDone(true)} lang={lang} />
        {splashDone && (
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Suspense fallback={null}>
              <Router />
            </Suspense>
          </WouterRouter>
        )}
        <Toaster />
      </MotionConfig>
    </QueryClientProvider>
  );
}

export default App;
