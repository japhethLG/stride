/**
 * Map geometry helpers (CLAUDE.md §5).
 *
 * Screens pass route/track geometry as real `[lng, lat]` coordinates (the wire
 * shape — see adapters `GeoPoint`). These helpers normalise the various inputs a
 * screen might hand <MapView> into a canonical `LngLat[]` and a GeoJSON
 * LineString, and compute bounds for camera fitting.
 *
 * NOTE on the design's SVG paths: the prototype FauxMap used SVG path strings in
 * a 0..100 viewBox (`"M x y L x y ..."`) and `{x,y}` percent markers. Those are a
 * fiction of the mock and are NOT a coordinate system — there is no real-world
 * anchor. We provide `svgPathToCoords` / `percentToLngLat` only as a thin bridge
 * so a CP5 screen still carrying demo geometry renders *something* on the real
 * basemap; production screens must pass true lng/lat.
 */

/** A real-world coordinate: `[lng, lat]` (GeoJSON / MapLibre order). */
export type LngLat = [number, number];

/** GeoJSON LineString geometry. */
export interface LineStringGeometry {
  type: "LineString";
  coordinates: LngLat[];
}

/** A GeoJSON Feature wrapping a LineString. */
export interface LineFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: LineStringGeometry;
}

/** Anything a screen might pass as a route/track line. */
export type LineInput =
  | LngLat[]
  | LineStringGeometry
  | LineFeature
  | { type: "Feature"; geometry: LineStringGeometry }
  | null
  | undefined;

function isLngLatArray(v: unknown): v is LngLat[] {
  return (
    Array.isArray(v) &&
    (v.length === 0 ||
      (Array.isArray(v[0]) &&
        v[0].length >= 2 &&
        typeof v[0][0] === "number" &&
        typeof v[0][1] === "number"))
  );
}

/**
 * Normalise any supported line input to a flat `LngLat[]`.
 * Returns `[]` for empty/invalid input so callers can branch on `.length`.
 */
export function toCoords(input: LineInput): LngLat[] {
  if (!input) return [];
  if (isLngLatArray(input)) return input;
  if (typeof input === "object" && "type" in input) {
    if (input.type === "LineString") return input.coordinates;
    if (input.type === "Feature" && input.geometry?.type === "LineString") {
      return input.geometry.coordinates;
    }
  }
  return [];
}

/** Wrap coordinates as a GeoJSON LineString Feature (what a line source wants). */
export function toLineFeature(input: LineInput): LineFeature {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: toCoords(input) },
  };
}

/**
 * Bounding box `[west, south, east, north]` of a set of coordinates, or `null`
 * when there are fewer than one point.
 */
export function boundsOf(coords: LngLat[]): [number, number, number, number] | null {
  if (!coords.length) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < w) w = lng;
    if (lng > e) e = lng;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [w, s, e, n];
}

/** Centroid (average) of coordinates, or `null` when empty. */
export function centerOf(coords: LngLat[]): LngLat | null {
  if (!coords.length) return null;
  let lng = 0;
  let lat = 0;
  for (const [x, y] of coords) {
    lng += x;
    lat += y;
  }
  return [lng / coords.length, lat / coords.length];
}

/* ------------------------------------------------------------------ *
 * Demo-geometry bridge (NOT for production geometry).                *
 * ------------------------------------------------------------------ */

/**
 * Map a design `{x,y}` percent point (0..100 viewBox space) onto a small bbox of
 * real lng/lat, so a demo marker lands somewhere coherent on the basemap. The
 * default bbox is a ~2km patch near the style's default center.
 */
export function percentToLngLat(
  x: number,
  y: number,
  bbox: [number, number, number, number],
): LngLat {
  const [w, s, e, n] = bbox;
  return [w + (x / 100) * (e - w), n - (y / 100) * (n - s)];
}

/**
 * Parse the design's SVG path string (`"M x y C ... L x y ..."`, 0..100 space)
 * into the numeric point list it visually traces, then project to lng/lat via
 * `percentToLngLat`. Curve control points are treated as on-path vertices —
 * good enough for a demo polyline, never for real routes.
 */
export function svgPathToCoords(
  d: string,
  bbox: [number, number, number, number],
): LngLat[] {
  const nums = d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  const out: LngLat[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    out.push(percentToLngLat(nums[i], nums[i + 1], bbox));
  }
  return out;
}
