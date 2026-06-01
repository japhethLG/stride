/**
 * MiniMap — small static route thumbnail used in list rows (ActivityRow,
 * RouteCard). Ported from design/project/stride-chrome.jsx (`MiniMap`) +
 * design/project/stride-map.jsx (`FauxMap`).
 *
 * This is the lightweight procedural renderer for thumbnails — NOT the
 * interactive map. Full interactive maps use the MapLibre `MapView` primitive
 * (src/components/map/MapView.tsx). `path` is a 0..100 viewBox SVG path string;
 * `seed` makes the faux street network deterministic per route.
 */
import { useMemo, type ReactNode } from "react";
import { buildStreets, type FauxMapStyle } from "./fauxMap";

export interface FauxMapProps {
  /** Planned-route path (drawn dashed under the recorded track). */
  routeD?: string;
  /** Recorded-track path (the glowing line). */
  trackD?: string;
  seed?: number;
  style?: FauxMapStyle;
  /** Override for `style` (the design's `mapStyle` prop). */
  mapStyle?: FauxMapStyle;
  dim?: boolean;
  glow?: boolean;
  children?: ReactNode;
}

/** Procedural faux map with a glowing route line (verbatim visuals). */
export function FauxMap({
  routeD,
  trackD,
  seed = 7,
  style = "streets",
  mapStyle,
  dim = false,
  glow = true,
  children,
}: FauxMapProps) {
  const st = mapStyle || style;
  const { roads, minor, blobs } = useMemo(() => buildStreets(seed, st), [seed, st]);
  const fid = "gl" + seed + st;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--map-bg)" }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          opacity: dim ? 0.5 : 1,
          transition: "opacity var(--dur)",
        }}
      >
        <defs>
          <filter id={fid} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="var(--map-land)" />
        {blobs.map((b, i) => (
          <ellipse
            key={i}
            cx={b.cx}
            cy={b.cy}
            rx={b.rx}
            ry={b.ry}
            transform={`rotate(${b.rot} ${b.cx} ${b.cy})`}
            fill={b.kind === "water" ? "var(--map-water)" : "var(--map-park)"}
            opacity="0.9"
          />
        ))}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={"h" + i} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="var(--map-grid)" strokeWidth="0.4" />
        ))}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={"v" + i} x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="var(--map-grid)" strokeWidth="0.4" />
        ))}
        {minor.map((d, i) => (
          <path key={"m" + i} d={d} stroke="var(--map-road)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        ))}
        {roads.map((d, i) => (
          <path key={"r" + i} d={d} stroke="var(--map-road-major)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        ))}
        {trackD && routeD && (
          <path
            d={routeD}
            stroke="var(--text-3)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="3 3"
            opacity="0.65"
          />
        )}
        {(trackD || routeD) && (
          <path
            d={trackD || routeD}
            stroke="var(--accent)"
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={glow ? `url(#${fid})` : undefined}
          />
        )}
        {(trackD || routeD) && (
          <path
            d={trackD || routeD}
            stroke="#fff"
            strokeWidth="0.7"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.5"
          />
        )}
      </svg>
      {children}
    </div>
  );
}

export interface MiniMapProps {
  /** Route/track path in 0..100 viewBox space. */
  path?: string;
  seed?: number;
  size?: number;
  r?: number;
  mapStyle?: FauxMapStyle;
  dim?: boolean;
}

export function MiniMap({ path, seed, size = 56, r = 14, mapStyle, dim }: MiniMapProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
        border: "1px solid var(--border)",
      }}
    >
      <FauxMap seed={seed} routeD={path} mapStyle={mapStyle} dim={dim} glow={size > 80} />
    </div>
  );
}
