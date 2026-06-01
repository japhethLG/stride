/**
 * React root: providers + RouterProvider (CLAUDE.md §3).
 *
 * Order: QueryClientProvider (server state) -> RouterProvider. AuthProvider is
 * mounted INSIDE the router (RootLayout in routes.tsx) so it can use router hooks.
 *
 * Styles: tokens.css first (CSS custom-property design tokens + dark/light +
 * keyframes), then global.css (app-shell layout). The CP4-approved deviation from
 * CLAUDE.md §1 is that we use these tokens + inline-style components instead of
 * Tailwind, for pixel fidelity with the design.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import "@/styles/tokens.css";
import "@/styles/global.css";
import { router } from "@/app/routes";

// Design defaults to the dark theme (accent #FF4D2E); index.html sets
// data-theme="dark" up front to avoid a flash. Theme/units state lands in CP5.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Don't retry auth failures — the client middleware already signs out.
        if (error && typeof error === "object" && "status" in error) {
          const status = (error as { status?: number }).status;
          if (status === 401 || status === 403) return false;
        }
        return failureCount < 2;
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
