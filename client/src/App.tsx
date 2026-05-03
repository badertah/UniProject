import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SettingsProvider } from "@/hooks/use-settings";
import { Layout } from "@/components/layout";
import { ThemeApplier } from "@/components/cosmetics";

import AuthPage from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import CoursesPage from "@/pages/courses";
import TopicPage from "@/pages/topic";
import GamePage from "@/pages/game";
import LeaderboardPage from "@/pages/leaderboard";
import ShopPage from "@/pages/shop";
import ProfilePage from "@/pages/profile";
import AdminPage from "@/pages/admin";
import FarmPage from "@/pages/farm";
import SettingsPage from "@/pages/settings";
import BadgesPage from "@/pages/badges";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <div className="w-6 h-6 rounded border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-mono tracking-widest">LOADING...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <div className="w-6 h-6 rounded border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-mono tracking-widest">INITIALIZING...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/auth">
        {user ? <Redirect to="/dashboard" /> : <AuthPage />}
      </Route>
      <Route path="/">
        {user ? <Redirect to="/dashboard" /> : <Redirect to="/auth" />}
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/courses">
        <ProtectedRoute component={CoursesPage} />
      </Route>
      <Route path="/courses/:id">
        <ProtectedRoute component={TopicPage} />
      </Route>
      <Route path="/game/:id">
        <ProtectedRoute component={GamePage} />
      </Route>
      <Route path="/leaderboard">
        <ProtectedRoute component={LeaderboardPage} />
      </Route>
      <Route path="/shop">
        <ProtectedRoute component={ShopPage} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={AdminPage} />
      </Route>
      <Route path="/farm">
        <ProtectedRoute component={FarmPage} />
      </Route>
      <Route path="/badges">
        <ProtectedRoute component={BadgesPage} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SettingsProvider>
          <AuthProvider>
            <ThemeApplier />
            <Router />
            <Toaster />
          </AuthProvider>
        </SettingsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
