import { Switch, Route, Router as WouterRouter, Link } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { ShieldAlert, Lock } from "lucide-react";

import Home from "@/pages/home";
import SearchPage from "@/pages/search";
import RoomDetail from "@/pages/room-detail";
import PostRoom from "@/pages/post-room";
import Recommendations from "@/pages/recommendations";
import Profile from "@/pages/profile";
import Messages from "@/pages/messages";
import Verification from "@/pages/verification";
import AdminDashboard from "@/pages/admin";
import OwnerDashboard from "@/pages/owner-dashboard";
import Register from "@/pages/register";
import Login from "@/pages/login";
import MatchesPage from "@/pages/matches";
import ContractsPage from "@/pages/contracts";
import KhaltiCallback from "@/pages/khalti-callback";
import NotFound from "@/pages/not-found";

// -------------------- Query Client --------------------
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// -------------------- Guards --------------------
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isRealUser, isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isRealUser || !user) {
    return <Login />;
  }

  return children;
}

function VerifiedRoute({ children }: { children: JSX.Element }) {
  const { isRealUser, isLoading, user } = useAuth();
  const isVerified = user?.isVerified ?? false;

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isRealUser || !user) {
    return <Login />;
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-3xl border shadow-sm p-8 text-center">
          <div className="mb-6 flex justify-start">
            <BackButton fallback="/" label="Back" className="text-left" />
          </div>
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-xl font-bold mb-2">Verified users only</h2>
          <p className="text-muted-foreground mb-6">
            Complete identity verification to access this section.
          </p>
          <Link href="/verification"><Button className="rounded-xl">Verify Now</Button></Link>
        </div>
      </div>
    );
  }

  return children;
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const { isRealUser, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isRealUser) {
    return <Login />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-3xl border shadow-sm p-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Lock size={28} />
          </div>
          <h2 className="text-xl font-bold mb-2">Admin Only</h2>
          <p className="text-muted-foreground mb-6">
            This section is only accessible to administrators.
          </p>
          <Link href="/"><Button className="rounded-xl">Go Home</Button></Link>
        </div>
      </div>
    );
  }

  return children;
}

// -------------------- Router --------------------
function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/register" component={Register} />
      <Route path="/login" component={Login} />

      {/* Protected routes */}
      <Route path="/messages">
        <VerifiedRoute>
          <Messages />
        </VerifiedRoute>
      </Route>

      <Route path="/matches">
        <VerifiedRoute>
          <MatchesPage />
        </VerifiedRoute>
      </Route>

      <Route path="/post">
        <ProtectedRoute>
          <PostRoom />
        </ProtectedRoute>
      </Route>

      <Route path="/contracts/khalti-callback">
        <Layout>
          <KhaltiCallback />
        </Layout>
      </Route>

      <Route path="/contracts/:id">
        <VerifiedRoute>
          <ContractsPage />
        </VerifiedRoute>
      </Route>

      <Route path="/contracts">
        <VerifiedRoute>
          <ContractsPage />
        </VerifiedRoute>
      </Route>

      {/* Admin route */}
      <Route path="/admin">
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      </Route>

      {/* Verification pages with shared layout */}
      <Route path="/verification">
        <Layout>
          <Verification />
        </Layout>
      </Route>
      <Route path="/verifications">
        <Layout>
          <Verification />
        </Layout>
      </Route>

      {/* Layout routes */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/search" component={SearchPage} />
            <Route path="/room/:id" component={RoomDetail} />
            <Route path="/recommendations" component={Recommendations} />
            <Route path="/profile" component={Profile} />
            <Route path="/messages/:userId/:ownerId" component={Messages} />
            <Route path="/my-listings" component={OwnerDashboard} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

// -------------------- App --------------------
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
          <Toaster />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;