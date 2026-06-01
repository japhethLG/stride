/**
 * AppShell — the chrome for every authenticated screen (CLAUDE.md §10, §4.1).
 *
 * Layout route: pages NEVER import it. It renders a full-viewport mobile layout
 * (the app is a phone-shaped PWA; no PhoneShell mock frame) and the BottomNav on
 * non-fullscreen authed routes. Fullscreen routes (login is public; record,
 * summary, live, route detail, members, leaderboard, activity, settings, create,
 * permissions) render edge-to-edge with no nav — see FULLSCREEN_PATHS.
 *
 * `useFullscreenRoute()` mirrors the design's FULLSCREEN set by matching the
 * current pathname; CP5 screens that need a TopBar render their own.
 */
import { Outlet, useMatches } from "react-router-dom";
import { BottomNav } from "@/components/chrome";

export interface RouteHandle {
  /** When true, the route renders edge-to-edge with no BottomNav. */
  fullscreen?: boolean;
}

function useIsFullscreen(): boolean {
  const matches = useMatches();
  return matches.some(
    (m) => (m.handle as RouteHandle | undefined)?.fullscreen === true,
  );
}

export function AppShell() {
  const fullscreen = useIsFullscreen();
  return (
    <div
      className="stride stride-app"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <main
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Outlet />
      </main>
      {!fullscreen && <BottomNav />}
    </div>
  );
}
