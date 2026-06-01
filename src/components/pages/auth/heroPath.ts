/**
 * Brand-hero demo route path (auth cluster local helper).
 *
 * The Login hero is decorative — it shows a representative loop on the basemap,
 * not real user data. <MapView> accepts an SVG path string as a demo-geometry
 * bridge (lib/map/geo.ts → svgPathToCoords over DEMO_BBOX), so we reuse the
 * design's `PATHS.riverside` shape verbatim for the same visual. No backend data
 * is appropriate here (the user isn't signed in yet), so this stays a static
 * constant rather than an entity hook.
 */
export const PATHS = {
  riverside:
    "M 22 78 C 14 64 18 50 30 46 C 44 41 40 26 54 24 C 70 22 78 32 76 46 C 74 60 60 60 56 70 C 52 80 36 86 22 78 Z",
} as const;
