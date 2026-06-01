/**
 * Map style config (CLAUDE.md §5).
 *
 * The shared basemap style lives here so changing the basemap = editing one file.
 * Page/primitive code never references a style URL directly — it reads
 * `MAP_STYLE` (or passes nothing and lets <MapView> default to it).
 *
 * CP4 basemap: OpenFreeMap "Liberty" vector style — free, keyless, no usage
 * caps (https://openfreemap.org). It is a light style; the design is dark, so
 * we ship a dark recolor applied at runtime (`applyDarkTheme`) over the live
 * style — OpenFreeMap has no official dark style yet, so we tint the loaded
 * style toward the design's `--map-*` tokens. Set `MAP_DARK` to false to keep
 * the stock light Liberty look.
 *
 * Self-host swap (later): point `MAP_STYLE` at a self-hosted style.json (and, if
 * using PMTiles, register the protocol in MapView) — nothing else changes.
 */
import type { StyleSpecification } from "maplibre-gl";

/** OpenFreeMap vector styles (keyless). Liberty = the general-purpose one. */
export const OPENFREEMAP_LIBERTY = "https://tiles.openfreemap.org/styles/liberty";

/** The basemap the app renders. A URL string or an inline StyleSpecification. */
export const MAP_STYLE: string | StyleSpecification = OPENFREEMAP_LIBERTY;

/** Recolor the (light) Liberty style toward the design's dark map tokens. */
export const MAP_DARK = true;

/**
 * A minimal keyless raster basemap (OpenStreetMap tiles). Offline/dev fallback
 * if the vector style host is unreachable — MapView falls back to this on a
 * style load error.
 */
export const RASTER_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

/** Design `--map-*` palette (dark theme) used by the runtime recolor. */
export const MAP_DARK_COLORS = {
  background: "#0C0E13",
  land: "#11141A",
  park: "#122019",
  water: "#0C1E2C",
  road: "#20252F",
  roadMajor: "#2C333F",
  label: "#8A93A3",
  labelHalo: "#090A0D",
} as const;

/** Default camera — a generic city view until a route/track sets bounds. */
export const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];
export const DEFAULT_ZOOM = 13;

/** A ~city-block bbox near the default center for projecting demo geometry. */
export const DEMO_BBOX: [number, number, number, number] = [
  -122.43, 37.765, -122.405, 37.785,
];
