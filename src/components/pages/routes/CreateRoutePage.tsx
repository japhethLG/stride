/**
 * CreateRoutePage — ported from design/project/screens-routes.jsx
 * `CreateRouteScreen`.
 *
 * Real wiring (CLAUDE.md §5): the design's FauxMap tap-canvas is replaced with
 * the MapLibre `MapView`. Drawing is **manual tap-to-draw** — map clicks drop
 * real `{lng,lat}` waypoints (`onMapClick`); the in-progress line is drawn via
 * `drawCoords` and an Undo control pops the last point. The map is mounted with
 * `fit={false}` so dropping a point NEVER moves the camera (the user keeps their
 * pan/zoom). Location comes from the shared `useUserLocation()` context (persisted
 * last-known + auto-refresh), so the map opens near the user — not the default
 * center — and a "me" marker shows where they are; locate-me re-centers. The
 * "Snap" toggle calls `useSnapRoute` (POST /api/routing/snap) whenever the
 * waypoints change (≥2 points) to snap the polyline to roads — the snapped
 * geometry + distance are shown live. Save POSTs via `useCreateRoute` (GeoJSON
 * LineString geometry, visibility from the make-public toggle, elevation) then
 * navigates to the new /routes/:id.
 *
 * Elevation gain is left to the server to recompute (we have no client-side DEM),
 * so the profile chart renders a flat baseline until the route detail loads it.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Btn, Field, Icon, IconBtn, Row, Segmented, Spinner, Toggle } from "@/components/primitives";
import { MapView } from "@/components/map/MapView";
import { useSnapRoute } from "@/lib/api/routing";
import { useCreateRoute } from "@/lib/api/routes";
import { useUnits } from "@/lib/prefs/store";
import { fmtKm, distUnit } from "@/lib/format";
import { useUserLocation } from "@/lib/location/UserLocationProvider";
import { DEFAULT_ZOOM } from "@/lib/map/style";
import type { CreateRouteRequestDto, RouteResponseDto } from "@/lib/api/types";
import { ElevationChart, lineCoords } from "./_shared";

type LngLat = [number, number];

/** Routing profiles GraphHopper is configured to serve (foot is the run default). */
type RouteProfile = "foot" | "bike" | "car";
const PROFILE_OPTIONS = [
  { value: "foot", label: "Foot" },
  { value: "bike", label: "Bike" },
  { value: "car", label: "Car" },
];
/** Zoom the camera flies to when locating the user. */
const LOCATE_ZOOM = 15;

/** Haversine distance (m) for a polyline of [lng,lat] points. */
function haversineMeters(coords: LngLat[]): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(a));
  }
  return total;
}

export function CreateRoutePage() {
  const nav = useNavigate();
  const units = useUnits();

  const [pts, setPts] = useState<LngLat[]>([]);
  const [snap, setSnap] = useState(true);
  const [profile, setProfile] = useState<RouteProfile>("foot");
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [isPublic, setPublic] = useState(false);
  // Shared user location (persisted last-known + auto-refresh) — so the map opens
  // near the user instead of flashing the default center.
  const loc = useUserLocation();
  // Capture the initial center ONCE (last-known or default) so the map mounts there;
  // a live fix refines it via flyTo below. Re-reads of `loc.center` must not
  // recreate the map.
  const [initialCenter] = useState<[number, number]>(() => loc.center);
  // The user's own position for the "me" marker (live fix, else last known).
  const userLoc: [number, number] | null = loc.current
    ? [loc.current.lng, loc.current.lat]
    : loc.lastKnown;

  // Measured bottom-panel height, so the locate button always sits above it.
  const [panelH, setPanelH] = useState(230);
  const panelRef = useRef<HTMLDivElement>(null);
  // If a fix resolves before the map is ready, recenter once onReady fires.
  const pendingCenterRef = useRef<[number, number] | null>(null);

  // Snapped geometry (when snap is on and the server returned a road-snapped path).
  const [snapped, setSnapped] = useState<{ coords: LngLat[]; distanceM: number } | null>(null);

  const snapRoute = useSnapRoute();
  const createRoute = useCreateRoute();

  // Live MapLibre instance (from MapView.onReady) for flyTo on locate-me.
  const mapRef = useRef<MapLibreMap | null>(null);
  // When true, the NEXT fresh fix re-centers the camera. Set on mount + locate-me,
  // cleared after flying — so background auto-refresh never yanks the camera mid-draw.
  const flyPendingRef = useRef(true);

  // Fly to a position now (map ready) or defer until onReady fires.
  const flyTo = (at: [number, number]) => {
    if (mapRef.current) mapRef.current.flyTo({ center: at, zoom: LOCATE_ZOOM });
    else pendingCenterRef.current = at;
  };

  // Re-center on the user's fix, but only when a fly was requested (mount/locate-me).
  useEffect(() => {
    if (!loc.current || !flyPendingRef.current) return;
    flyTo([loc.current.lng, loc.current.lat]);
    flyPendingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.current]);

  const locateMe = () => {
    flyPendingRef.current = true;
    void loc.refresh();
  };

  // --- keep the locate button above the (variable-height) bottom panel ---
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    setPanelH(el.offsetHeight);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setPanelH(e.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-snap whenever the waypoints/profile change and snap is enabled (≥2 points).
  const reqIdRef = useRef(0);
  useEffect(() => {
    if (!snap || pts.length < 2) {
      setSnapped(null);
      return;
    }
    const reqId = ++reqIdRef.current;
    snapRoute.mutate(
      { body: { points: pts.map(([lng, lat]) => ({ lat, lng })), profile } },
      {
        onSuccess: (data) => {
          if (reqId !== reqIdRef.current) return; // stale response
          const res = data as { geometry?: { coordinates?: number[][] }; distanceM?: number; snapped?: boolean };
          const coords = lineCoords(res.geometry as never);
          if (res.snapped && coords.length >= 2) {
            setSnapped({ coords, distanceM: res.distanceM ?? haversineMeters(coords) });
          } else {
            setSnapped(null);
          }
        },
        onError: () => {
          if (reqId === reqIdRef.current) setSnapped(null);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, snap, profile]);

  // The geometry we draw + save: snapped path when available, else raw waypoints.
  const drawCoords: LngLat[] = snap && snapped ? snapped.coords : pts;
  const distanceM =
    snap && snapped ? snapped.distanceM : pts.length >= 2 ? haversineMeters(pts) : 0;
  const distKm = distanceM / 1000;
  const elev = 0; // server recomputes elevation gain from geometry

  const addPoint = (point: { lng: number; lat: number }) => {
    setPts((p) => [...p, [point.lng, point.lat]]);
  };
  const undo = () => setPts((p) => p.slice(0, -1));

  const save = async () => {
    if (drawCoords.length < 2 || !name) return;
    const body: CreateRouteRequestDto = {
      name,
      visibility: isPublic ? "public" : "private",
      geometry: { type: "LineString", coordinates: drawCoords.map(([lng, lat]) => [lng, lat]) },
      distanceMeters: distanceM,
      elevation: { gainMeters: 0 },
    };
    try {
      const created = (await createRoute.mutateAsync({ body })) as RouteResponseDto;
      nav("/routes/" + created.id, { replace: true });
    } catch {
      /* error surfaced below via createRoute.isError */
    }
  };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* map canvas (real MapLibre, draw mode) */}
      <div style={{ position: "absolute", inset: 0 }}>
        <MapView
          center={initialCenter}
          zoom={DEFAULT_ZOOM}
          // Never auto-fit: dropping a point must NOT move the camera — the user
          // keeps whatever pan/zoom they set (locate-me flyTo is the only camera move).
          fit={false}
          onReady={(map) => {
            mapRef.current = map;
            if (pendingCenterRef.current) {
              map.flyTo({ center: pendingCenterRef.current, zoom: LOCATE_ZOOM });
              pendingCenterRef.current = null;
            }
          }}
          onMapClick={addPoint}
          drawCoords={drawCoords}
          markers={[
            // the user's own location (ping marker), shown while drawing
            ...(userLoc ? [{ lng: userLoc[0], lat: userLoc[1], type: "me" as const }] : []),
            ...(drawCoords.length
              ? [
                  { lng: drawCoords[0][0], lat: drawCoords[0][1], type: "start" as const },
                  ...(drawCoords.length > 1
                    ? [
                        {
                          lng: drawCoords[drawCoords.length - 1][0],
                          lat: drawCoords[drawCoords.length - 1][1],
                          type: "finish" as const,
                        },
                      ]
                    : []),
                ]
              : []),
          ]}
        />
      </div>

      {/* top controls */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 14,
          right: 14,
          display: "flex",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <IconBtn
          name="chevL"
          onClick={() => nav(-1)}
          style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "#fff" }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <IconBtn
            name="refresh"
            onClick={undo}
            style={{
              background: "rgba(0,0,0,.45)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              opacity: pts.length ? 1 : 0.4,
              pointerEvents: pts.length ? "auto" : "none",
            }}
          />
          <button
            onClick={() => setSnap((s) => !s)}
            style={{
              height: 40,
              padding: "0 14px",
              borderRadius: "var(--r-pill)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              background: snap ? "var(--accent)" : "rgba(0,0,0,.45)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="route" size={16} />
            Snap {snap ? "on" : "off"}
            {snap && snapRoute.isPending && pts.length >= 2 ? " …" : ""}
          </button>
        </div>
      </div>

      {pts.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "38%",
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 6,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(0,0,0,.55)",
              backdropFilter: "blur(8px)",
              padding: "10px 16px",
              borderRadius: "var(--r-pill)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13.5,
            }}
          >
            <Icon name="plus" size={17} /> Tap the map to drop your first point
          </div>
        </div>
      )}

      {/* locate-me — sits just above the bottom panel; spinner while locating */}
      <div
        style={{
          position: "absolute",
          right: 14,
          bottom: panelH + 14,
          zIndex: 30,
          transition: "bottom .2s var(--ease-out)",
        }}
      >
        {loc.locating ? (
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--shadow)",
            }}
          >
            <Spinner size={20} color="var(--accent)" />
          </div>
        ) : (
          <IconBtn
            name="locate"
            size={46}
            iconSize={22}
            onClick={locateMe}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow)",
            }}
          />
        )}
      </div>

      {loc.locating && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 6,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "rgba(0,0,0,.5)",
              backdropFilter: "blur(8px)",
              padding: "7px 13px",
              borderRadius: "var(--r-pill)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            <Spinner size={13} color="#fff" /> Locating you…
          </div>
        </div>
      )}

      {loc.error && !loc.locating && !userLoc && pts.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 6,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(0,0,0,.5)",
              backdropFilter: "blur(8px)",
              padding: "7px 13px",
              borderRadius: "var(--r-pill)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            <Icon name="info" size={14} /> Location unavailable — pan the map to start
          </div>
        </div>
      )}

      {/* bottom sheet */}
      <div
        ref={panelRef}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--surface)",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid var(--border)",
          zIndex: 20,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          onClick={() => setExpanded((e) => !e)}
          style={{ padding: "10px 0 4px", display: "flex", justifyContent: "center", cursor: "pointer" }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border-strong)" }} />
        </div>
        <div style={{ padding: "6px 20px 22px" }}>
          <Row style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <div className="eyebrow" style={{ fontSize: 10 }}>
                  Distance
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                  <span className="stat-num" style={{ fontSize: 34 }}>
                    {fmtKm(distKm, units)}
                  </span>
                  <span style={{ color: "var(--text-3)", fontWeight: 700, fontSize: 13 }}>
                    {distUnit(units)}
                  </span>
                </div>
              </div>
              <div>
                <div className="eyebrow" style={{ fontSize: 10 }}>
                  Elev gain
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                  <span className="stat-num" style={{ fontSize: 34 }}>
                    +{elev}
                  </span>
                  <span style={{ color: "var(--text-3)", fontWeight: 700, fontSize: 13 }}>m</span>
                </div>
              </div>
            </div>
            <div style={{ color: "var(--text-3)", fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>
              {pts.length} point{pts.length !== 1 ? "s" : ""}
            </div>
          </Row>

          {/* routing profile — re-snaps the geometry when changed */}
          <div style={{ marginTop: 14 }}>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>
              Routing
            </div>
            <Segmented
              options={PROFILE_OPTIONS}
              value={profile}
              onChange={(v) => setProfile(v as RouteProfile)}
            />
          </div>

          {expanded && (
            <div style={{ marginTop: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Elevation profile
              </div>
              <ElevationChart id="eg-create" />
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <Field
                  label="Route name"
                  value={name}
                  onChange={setName}
                  placeholder="e.g. Riverside Loop"
                  icon="route"
                />
                <Row style={{ justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>Make public</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                      Anyone can find and run it
                    </div>
                  </div>
                  <Toggle value={isPublic} onChange={setPublic} />
                </Row>
                {createRoute.isError && (
                  <div style={{ fontSize: 12.5, color: "var(--danger)", fontWeight: 600 }}>
                    {createRoute.error?.message ?? "Couldn't save route."}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Btn
              full
              size="lg"
              loading={createRoute.isPending}
              disabled={pts.length < 2 || (expanded && !name)}
              onClick={() => (expanded ? save() : setExpanded(true))}
            >
              {expanded
                ? "Save route"
                : pts.length < 2
                  ? "Add at least 2 points"
                  : "Review & save"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
