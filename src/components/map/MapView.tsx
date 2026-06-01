/**
 * MapView — the ONE MapLibre primitive (CLAUDE.md §5).
 *
 * Page code uses <MapView> + overlay children; it must NEVER
 * `new maplibregl.Map(...)` inline. This is the real-basemap replacement for the
 * design's FauxMap (stride-map.jsx): it renders an OpenFreeMap vector basemap
 * (dark-recolored to match the design), draws the route/track as a glowing line
 * layer, and places start/finish/me/runner DOM markers.
 *
 * Prop surface is FauxMap-compatible so CP5 screens drop it in with minimal
 * change — `routeD`/`trackD`/`markers`/`fit`/`glow` map to the design's props.
 * The one shift: geometry is REAL `[lng,lat]` now (GeoJSON LineString,
 * coordinate arrays, or — as a demo bridge — the old SVG path / `{x,y}` markers,
 * see lib/map/geo.ts). Camera helpers (`fit`) and the draw API (`onMapClick` +
 * `drawCoords`) are additive; `onReady` still hands back the live instance for
 * advanced overlays (RouteLayer / LiveRunnersLayer land on top of this).
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import maplibregl, {
  Marker,
  type Map as MapLibreMap,
  type MapLayerMouseEvent,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MAP_STYLE,
  MAP_DARK,
  RASTER_FALLBACK_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  DEMO_BBOX,
} from "@/lib/map/style";
import { applyDarkTheme } from "@/lib/map/darkTheme";
import {
  toCoords,
  toLineFeature,
  boundsOf,
  svgPathToCoords,
  percentToLngLat,
  type LineInput,
  type LngLat,
} from "@/lib/map/geo";
import {
  buildMarkerElement,
  markerLngLat,
  type MapMarkerSpec,
} from "@/lib/map/markers";

const ROUTE_SRC = "stride-route";
const TRACK_SRC = "stride-track";
const DRAW_SRC = "stride-draw";

const ACCENT = "#FF4D2E";
const NEUTRAL = "#8A93A3";

/** Anything accepted as a route/track line: GeoJSON, coords, or a demo SVG path. */
export type MapLineInput = LineInput | string;

export interface MapViewProps {
  /** Initial camera center `[lng, lat]`. Ignored when `fit` has geometry. */
  center?: [number, number];
  zoom?: number;
  /** Disable pan/zoom (mini/preview maps). Default true. */
  interactive?: boolean;
  /** Container style overrides (the map fills its container by default). */
  style?: CSSProperties;

  /** Planned route — drawn neutral + dashed under the track. */
  routeD?: MapLineInput;
  /** Recorded track — drawn as the glowing accent line. */
  trackD?: MapLineInput;
  /** Glow (wider translucent line beneath the main line). Default true. */
  glow?: boolean;

  /** DOM markers (start/finish/me/runner/dot). Real lng/lat preferred. */
  markers?: MapMarkerSpec[];

  /** Auto-fit the camera to route+track+markers when they change. Default true. */
  fit?: boolean;
  /** fitBounds padding in px. Default 48. */
  fitPadding?: number;

  /** Draw mode: called with `{lng,lat}` on each map click (drop a waypoint). */
  onMapClick?: (point: { lng: number; lat: number }) => void;
  /** In-progress drawn line (Create Route). Rendered as a dashed accent line. */
  drawCoords?: LngLat[];

  /** Called once the basemap `load` fires, with the live instance. */
  onReady?: (map: MapLibreMap) => void;
  /** Overlays — rendered only after load. */
  children?: ReactNode;
}

/** Normalise a line input that may be a demo SVG path string. */
function resolveLine(input: MapLineInput | undefined): LngLat[] {
  if (input == null) return [];
  if (typeof input === "string") return svgPathToCoords(input, DEMO_BBOX);
  return toCoords(input);
}

/** Set a GeoJSON source's data to a LineString of the given coordinates. */
function setLineData(map: MapLibreMap, srcId: string, coords: LngLat[]): void {
  const src = map.getSource(srcId) as GeoJSONSource | undefined;
  src?.setData(toLineFeature(coords) as never);
}

/** Add a line layer pair (glow underlay + crisp top line) for a source id. */
function addLineLayers(
  map: MapLibreMap,
  srcId: string,
  opts: {
    color: string;
    width: number;
    glow: boolean;
    dashed?: boolean;
    highlight?: boolean;
  },
): void {
  if (opts.glow) {
    map.addLayer({
      id: `${srcId}-glow`,
      type: "line",
      source: srcId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": opts.color,
        "line-width": opts.width * 3,
        "line-blur": opts.width * 2.5,
        "line-opacity": 0.45,
      },
    });
  }
  map.addLayer({
    id: srcId,
    type: "line",
    source: srcId,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": opts.color,
      "line-width": opts.width,
      ...(opts.dashed ? { "line-dasharray": [2, 2], "line-opacity": 0.7 } : {}),
    },
  });
  if (opts.highlight) {
    // thin white centerline like the design's overlay highlight
    map.addLayer({
      id: `${srcId}-hi`,
      type: "line",
      source: srcId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#fff", "line-width": 1, "line-opacity": 0.5 },
    });
  }
}

export function MapView({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  interactive = true,
  style,
  routeD,
  trackD,
  glow = true,
  markers,
  fit = true,
  fitPadding = 48,
  onMapClick,
  drawCoords,
  onReady,
  children,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerObjsRef = useRef<Marker[]>([]);
  const onMapClickRef = useRef(onMapClick);
  const [ready, setReady] = useState(false);

  // keep the click handler current without re-creating the map
  onMapClickRef.current = onMapClick;

  // --- create the map once ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center,
      zoom,
      interactive,
      attributionControl: false,
    });
    mapRef.current = map;

    const finishLoad = () => {
      // empty sources for route/track/draw — layers added after style load
      for (const id of [ROUTE_SRC, TRACK_SRC, DRAW_SRC]) {
        if (!map.getSource(id)) {
          map.addSource(id, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        }
      }
      setReady(true);
      onReady?.(map);
    };

    map.on("load", () => {
      if (MAP_DARK) {
        try {
          applyDarkTheme(map);
        } catch {
          /* recolor is best-effort */
        }
      }
      finishLoad();
    });

    // fall back to the keyless raster basemap if the vector style can't load
    map.on("error", (e) => {
      const msg = String(e?.error?.message ?? "");
      if (/style|sprite|glyphs|tiles\.openfreemap/i.test(msg) && !map.isStyleLoaded()) {
        try {
          map.setStyle(RASTER_FALLBACK_STYLE);
        } catch {
          /* nothing more we can do */
        }
      }
    });

    map.on("click", (e: MapLayerMouseEvent) => {
      onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });

    return () => {
      for (const m of markerObjsRef.current) m.remove();
      markerObjsRef.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // create once; everything else is driven by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- crosshair cursor in draw mode ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getCanvas().style.cursor = onMapClick ? "crosshair" : "";
  }, [ready, onMapClick]);

  // --- route + track geometry ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const routeCoords = resolveLine(routeD);
    const trackCoords = resolveLine(trackD);

    // Planned route: neutral dashed, but only drawn when a track ALSO exists
    // (matching the design — a lone route renders as the glowing line below).
    // Track (or route-as-track when no track): the glowing accent line.
    const hasTrack = trackCoords.length > 0;
    setLineData(map, ROUTE_SRC, hasTrack ? routeCoords : []);
    setLineData(map, TRACK_SRC, hasTrack ? trackCoords : routeCoords);

    if (!map.getLayer(ROUTE_SRC)) {
      addLineLayers(map, ROUTE_SRC, {
        color: NEUTRAL,
        width: 2,
        glow: false,
        dashed: true,
      });
    }
    if (!map.getLayer(TRACK_SRC)) {
      addLineLayers(map, TRACK_SRC, {
        color: ACCENT,
        width: 4,
        glow,
        highlight: true,
      });
    }
  }, [ready, routeD, trackD, glow]);

  // --- in-progress drawn line ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setLineData(map, DRAW_SRC, drawCoords ?? []);
    if (!map.getLayer(DRAW_SRC)) {
      addLineLayers(map, DRAW_SRC, {
        color: ACCENT,
        width: 3,
        glow: false,
        dashed: true,
      });
    }
  }, [ready, drawCoords]);

  // --- markers ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const m of markerObjsRef.current) m.remove();
    markerObjsRef.current = [];
    const project = (x: number, y: number) => percentToLngLat(x, y, DEMO_BBOX);
    for (const spec of markers ?? []) {
      const at = markerLngLat(spec, project);
      if (!at) continue;
      const marker = new Marker({ element: buildMarkerElement(spec) })
        .setLngLat(at)
        .addTo(map);
      markerObjsRef.current.push(marker);
    }
  }, [ready, markers]);

  // --- camera fit ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !fit) return;
    const all: LngLat[] = [
      ...resolveLine(routeD),
      ...resolveLine(trackD),
      ...(drawCoords ?? []),
    ];
    const project = (x: number, y: number) => percentToLngLat(x, y, DEMO_BBOX);
    for (const spec of markers ?? []) {
      const at = markerLngLat(spec, project);
      if (at) all.push(at);
    }
    const b = boundsOf(all);
    if (!b) return;
    const [w, s, e, n] = b;
    if (w === e && s === n) {
      map.easeTo({ center: [w, s], zoom: Math.max(map.getZoom(), 15) });
    } else {
      map.fitBounds([[w, s], [e, n]], {
        padding: fitPadding,
        maxZoom: 17,
        duration: 600,
      });
    }
  }, [ready, fit, fitPadding, routeD, trackD, drawCoords, markers]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "var(--map-bg)",
        ...style,
      }}
    >
      {ready && children}
    </div>
  );
}
