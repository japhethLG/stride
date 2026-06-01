/**
 * PagePlaceholder — CP4 stand-in for a real screen.
 *
 * Each route renders a page composite under `components/pages/<feature>/` (CLAUDE
 * §4.2). CP5 replaces these bodies with the ported design screens
 * (design/project/screens-*.jsx). Pages read their own params via `useParams()`;
 * route data comes via an entity hook (e.g. `useMyActivities`); the map comes via
 * the `<MapView>` primitive. This placeholder just labels the route + shows any
 * params so the shell is navigable.
 */
import { useParams } from "react-router-dom";

export function PagePlaceholder({ label }: { label: string }) {
  const params = useParams();
  const paramText = Object.entries(params)
    .map(([k, v]) => `${k}: ${v}`)
    .join("  ·  ");
  return (
    <div
      className="stride"
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 24,
        textAlign: "center",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <div
        className="eyebrow"
        style={{ color: "var(--accent)" }}
      >
        Stride · CP4
      </div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 34 }}>{label}</h1>
      {paramText && (
        <div style={{ color: "var(--text-3)", fontSize: 13.5 }}>{paramText}</div>
      )}
      <div style={{ color: "var(--text-2)", fontSize: 13.5, marginTop: 4 }}>
        Screen lands in CP5
      </div>
    </div>
  );
}
