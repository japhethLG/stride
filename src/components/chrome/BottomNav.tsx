/**
 * BottomNav — the 4-tab bottom navigation (ported from
 * design/project/stride-chrome.jsx `BottomNav` / `TABS`).
 *
 * The design drove this with `tab`/`onTab` props; here it's wired to react-router
 * `NavLink` directly (the active tab derives from the URL) and renders through the
 * shared `Icon` primitive. The path set + tab set are identical to the design:
 * Home(/) · Routes(/routes) · Record(/record, center CTA) · Profile(/profile).
 *
 * Mounted by AppShell on non-fullscreen authed routes (§10).
 */
import { NavLink, useNavigate } from "react-router-dom";
import { Icon, type IconName } from "@/components/primitives";

interface Tab {
  id: string;
  route: string;
  icon: IconName;
  label: string;
  center?: boolean;
}

export const TABS: Tab[] = [
  { id: "home", route: "/", icon: "home", label: "Home" },
  { id: "routes", route: "/routes", icon: "route", label: "Routes" },
  { id: "record", route: "/record", icon: "play", label: "Record", center: true },
  { id: "profile", route: "/profile", icon: "profile", label: "Profile" },
];

export function BottomNav() {
  const navigate = useNavigate();
  return (
    <nav
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-around",
        padding: "8px 12px 12px",
        background: "var(--bg)",
        borderTop: "1px solid var(--border)",
        position: "relative",
        zIndex: 20,
      }}
    >
      {TABS.map((tb) => {
        if (tb.center) {
          return (
            <button
              key={tb.id}
              type="button"
              onClick={() => navigate(tb.route)}
              aria-label={tb.label}
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                marginTop: -22,
                background: "var(--accent)",
                color: "var(--on-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px var(--accent-soft), 0 6px 16px rgba(0,0,0,.4)",
              }}
            >
              <Icon name="play" size={26} fill color="#fff" stroke={0} />
            </button>
          );
        }
        return (
          <NavLink
            key={tb.id}
            to={tb.route}
            end={tb.route === "/"}
            style={({ isActive }) => ({
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "4px 14px",
              textDecoration: "none",
              color: isActive ? "var(--accent)" : "var(--text-3)",
              transition: "color var(--dur)",
              flex: 1,
            })}
          >
            {({ isActive }) => (
              <>
                <Icon name={tb.icon} size={24} stroke={isActive ? 2.4 : 2} />
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".3px" }}>
                  {tb.label}
                </span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
