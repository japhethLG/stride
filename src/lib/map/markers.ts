/**
 * Marker DOM builders — ported from the design's `MapMarker` (stride-map.jsx)
 * so MapLibre custom-DOM markers look identical to the prototype.
 *
 * MapLibre anchors a marker's element at the geo point; the design centered each
 * marker on its point (`translate(-50%,-50%)`), so we build the inner visual and
 * let MapLibre's default `center` anchor handle positioning. Runner labels sit
 * above the dot via a column flex, matching the design.
 */
import type { LngLat } from "./geo";

export type MarkerType = "start" | "finish" | "me" | "runner" | "dot";

/** A marker the screens pass to <MapView>. Accepts real `lng/lat` (preferred). */
export interface MapMarkerSpec {
  /** Real-world longitude. */
  lng?: number;
  /** Real-world latitude. */
  lat?: number;
  /** Design demo space (0..100 percent) — projected via DEMO_BBOX if no lng/lat. */
  x?: number;
  y?: number;
  type?: MarkerType;
  /** Override color (runner/dot). Defaults to the design's accent. */
  color?: string;
  /** Runner label (e.g. first name). */
  label?: string;
  /** Dim an offline runner. */
  dim?: boolean;
}

const ACCENT = "var(--accent)";

function el(tag: string, css: Partial<CSSStyleDeclaration>): HTMLElement {
  const node = document.createElement(tag);
  Object.assign(node.style, css);
  return node;
}

const flagSvg = (color: string): string =>
  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;

/** Build the DOM element for a marker spec, matching the design's MapMarker. */
export function buildMarkerElement(spec: MapMarkerSpec): HTMLElement {
  const type = spec.type ?? "dot";
  const color = spec.color ?? ACCENT;

  if (type === "start") {
    return el("div", {
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      background: "var(--live)",
      border: "3px solid var(--bg)",
      boxShadow: "0 0 0 2px var(--live)",
      cursor: "default",
    });
  }

  if (type === "finish") {
    const wrap = el("div", {
      width: "22px",
      height: "22px",
      borderRadius: "50%",
      background: "var(--bg)",
      border: "2px solid #fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "default",
    });
    wrap.innerHTML = flagSvg("#fff");
    return wrap;
  }

  if (type === "me") {
    const wrap = el("div", {
      position: "relative",
      width: "20px",
      height: "20px",
      cursor: "default",
    });
    const ping = el("span", {
      position: "absolute",
      inset: "-8px",
      borderRadius: "50%",
      background: ACCENT,
      opacity: "0.3",
      animation: "stridePing 1.8s ease-out infinite",
    });
    const dot = el("span", {
      position: "absolute",
      inset: "0",
      borderRadius: "50%",
      background: ACCENT,
      border: "3px solid var(--bg)",
      boxShadow: "0 2px 8px rgba(0,0,0,.5)",
    });
    wrap.append(ping, dot);
    return wrap;
  }

  if (type === "runner") {
    const wrap = el("div", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "3px",
      opacity: spec.dim ? "0.45" : "1",
      cursor: "default",
    });
    if (spec.label) {
      const tag = el("span", {
        fontSize: "10px",
        fontWeight: "800",
        color: "#fff",
        background: color,
        padding: "1px 6px",
        borderRadius: "var(--r-pill)",
        whiteSpace: "nowrap",
        boxShadow: "0 2px 6px rgba(0,0,0,.4)",
      });
      tag.textContent = spec.label;
      wrap.appendChild(tag);
    }
    const dot = el("span", {
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      background: color,
      border: "2.5px solid var(--bg)",
      boxShadow: "0 2px 6px rgba(0,0,0,.5)",
    });
    wrap.appendChild(dot);
    return wrap;
  }

  // default dot
  return el("div", {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: color,
    border: "2px solid var(--bg)",
    cursor: "default",
  });
}

/** Resolve a marker spec's geographic position. Returns null if unresolvable. */
export function markerLngLat(
  spec: MapMarkerSpec,
  project: (x: number, y: number) => LngLat,
): LngLat | null {
  if (typeof spec.lng === "number" && typeof spec.lat === "number") {
    return [spec.lng, spec.lat];
  }
  if (typeof spec.x === "number" && typeof spec.y === "number") {
    return project(spec.x, spec.y);
  }
  return null;
}
