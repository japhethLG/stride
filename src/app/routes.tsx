/**
 * Router (CLAUDE.md §4.1, §4.2).
 *
 * createBrowserRouter with ALL app routes (paths match the design's
 * matchRoute exactly). Structure:
 *   /login                         — PUBLIC, outside the shell
 *   <AuthGuard><AppShell/>         — every authed route renders inside the shell
 *
 * Each route's `element` is just the page composite (it reads its own params via
 * useParams — no params threaded through the table; no logic here). Fullscreen
 * routes set `handle: { fullscreen: true }` so AppShell hides the BottomNav. The
 * design's tabbed nav surfaces Home / Routes / Record / Profile.
 */
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AppShell, type RouteHandle } from "@/components/layout/AppShell";
import { AuthProvider, useAuth } from "@/lib/auth/AuthProvider";
import { UserLocationProvider } from "@/lib/location/UserLocationProvider";

import { HomePage } from "@/components/pages/home/HomePage";
import { LoginPage } from "@/components/pages/auth/LoginPage";
import { PermissionsPage } from "@/components/pages/onboarding/PermissionsPage";
import { RoutesPage } from "@/components/pages/routes/RoutesPage";
import { CreateRoutePage } from "@/components/pages/routes/CreateRoutePage";
import { RouteDetailPage } from "@/components/pages/routes/RouteDetailPage";
import { RouteMembersPage } from "@/components/pages/routes/RouteMembersPage";
import { RouteLeaderboardPage } from "@/components/pages/routes/RouteLeaderboardPage";
import { RouteLivePage } from "@/components/pages/routes/RouteLivePage";
import { RecordPage } from "@/components/pages/record/RecordPage";
import { RecordSummaryPage } from "@/components/pages/record/RecordSummaryPage";
import { ActivityDetailPage } from "@/components/pages/activities/ActivityDetailPage";
import { ProfilePage } from "@/components/pages/profile/ProfilePage";
import { SettingsPage } from "@/components/pages/settings/SettingsPage";

/**
 * Root layout: mounts AuthProvider INSIDE the router so it can use `useNavigate`
 * (for the 401 -> /login redirect) while every route reads `useAuth()`.
 */
function RootLayout() {
  return (
    <AuthProvider>
      <UserLocationProvider>
        <Outlet />
      </UserLocationProvider>
    </AuthProvider>
  );
}

/** Redirects to /login when signed out. It does NOT live in AuthProvider (§11.3). */
function AuthGuard() {
  const { user, ready } = useAuth();
  if (!ready) return null; // first auth emission pending; avoid a login flash
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

const fullscreen: RouteHandle = { fullscreen: true };

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // Public — outside the shell.
      { path: "/login", element: <LoginPage /> },

      // Authenticated — inside the shell (renders the BottomNav on tab routes).
      {
        element: <AuthGuard />,
        children: [
          {
            element: <AppShell />,
            children: [
          { index: true, element: <HomePage /> },
          { path: "/routes", element: <RoutesPage /> },
          { path: "/profile", element: <ProfilePage /> },

          // Fullscreen authed routes (no BottomNav).
          { path: "/onboarding/permissions", element: <PermissionsPage />, handle: fullscreen },
          { path: "/routes/new", element: <CreateRoutePage />, handle: fullscreen },
          { path: "/routes/:id", element: <RouteDetailPage />, handle: fullscreen },
          { path: "/routes/:id/members", element: <RouteMembersPage />, handle: fullscreen },
          { path: "/routes/:id/leaderboard", element: <RouteLeaderboardPage />, handle: fullscreen },
          { path: "/routes/:id/live", element: <RouteLivePage />, handle: fullscreen },
          { path: "/record", element: <RecordPage />, handle: fullscreen },
          { path: "/record/summary", element: <RecordSummaryPage />, handle: fullscreen },
          { path: "/activities/:id", element: <ActivityDetailPage />, handle: fullscreen },
          { path: "/settings", element: <SettingsPage />, handle: fullscreen },
            ],
          },
        ],
      },

      // Fallback.
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
