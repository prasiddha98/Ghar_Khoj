import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";

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

  const isVerified = user?.isVerified ?? false;

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isRealUser || !user || !isVerified) {
    return <Login />;
  }

  return children;
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const { isRealUser, isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const role = user?.role?.toLowerCase?.();
  const isAdmin = role === "admin";

  if (!isRealUser || !user || !isAdmin) {
    return <NotFound />;
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
        <ProtectedRoute>
          <Messages />
        </ProtectedRoute>
      </Route>

      <Route path="/matches">
        <ProtectedRoute>
          <MatchesPage />
        </ProtectedRoute>
      </Route>

      <Route path="/post">
        <ProtectedRoute>
          <PostRoom />
        </ProtectedRoute>
      </Route>

      <Route path="/contracts">
        <ProtectedRoute>
          <ContractsPage />
        </ProtectedRoute>
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