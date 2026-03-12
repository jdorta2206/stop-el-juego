import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/Home";
import SoloGame from "@/pages/SoloGame";
import Multiplayer from "@/pages/Multiplayer";
import Room from "@/pages/Room";
import Ranking from "@/pages/Ranking";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
