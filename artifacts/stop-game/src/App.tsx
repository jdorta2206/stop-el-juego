import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { SplashScreen } from "@/components/SplashScreen";
import Home from "@/pages/Home";
import SoloGame from "@/pages/SoloGame";
import Multiplayer from "@/pages/Multiplayer";
import Room from "@/pages/Room";
import Ranking from "@/pages/Ranking";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import About from "@/pages/About";
import HowToPlay from "@/pages/HowToPlay";
import DailyChallenge from "@/pages/DailyChallenge";
import Friends from "@/pages/Friends";
import Strategies from "@/pages/Strategies";
import PlayerProfile from "@/pages/PlayerProfile";
import NotFound from "@/pages/not-found";

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
      <Route path="/ranking" component={Ranking} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/acerca" component={About} />
      <Route path="/como-jugar" component={HowToPlay} />
      <Route path="/reto" component={DailyChallenge} />
      <Route path="/amigos" component={Friends} />
      <Route path="/estrategias" component={Strategies} />
      <Route path="/player/:id" component={PlayerProfile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const lang = (localStorage.getItem("stop_lang") ?? "es") as string;

  return (
    <QueryClientProvider client={queryClient}>
      <SplashScreen onDone={() => setSplashDone(true)} lang={lang} />
      {splashDone && (
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      )}
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
