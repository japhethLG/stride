/**
 * CreateRoutePage — ported from design/project/screens-routes.jsx
 * `CreateRouteScreen`.
 *
 * Real wiring (CLAUDE.md §5): the design's FauxMap tap-canvas is replaced with
 * the MapLibre `MapView`. Map clicks drop real `{lng,lat}` waypoints
 * (`onMapClick`); the in-progress line is drawn via `drawCoords`. The "Snap"
 * toggle calls `useSnapRoute` (POST /api/routing/snap) whenever the waypoints
 * change (≥2 points) to snap the polyline to roads — the snapped geometry +
 * distance are shown live. Save POSTs via `useCreateRoute` (GeoJSON LineString
 * geometry, visibility from the make-public toggle, elevation) then navigates to
 * the new /routes/:id.
 *
 * Elevation gain is left to the server to recompute (we have no client-side DEM),
 * so the profile chart renders a flat baseline until the route detail loads it.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Btn, Field, Icon, IconBtn, Row, Toggle } from "@/components/primitives";
import { MapView } from "@/components/map/MapView";
import { useSnapRoute } from "@/lib/api/routing";
import { useCreateRoute } from "@/lib/api/routes";
import { useUnits } from "@/lib/prefs/store";
import { fmtKm, distUnit } from "@/lib/format";
import type { CreateRouteRequestDto, RouteResponseDto } from "@/lib/api/types";
import { ElevationChart, lineCoords } from "./_shared";

type LngLat = [number, number];

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
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [isPublic, setPublic] = useState(false);

  // Snapped geometry (when snap is on and the server returned a road-snapped path).
  const [snapped, setSnapped] = useState<{ coords: LngLat[]; distanceM: number } | null>(null);

  const snapRoute = useSnapRoute();
  const createRoute = useCreateRoute();

  // Re-snap whenever the waypoints change and snap is enabled (≥2 points).
  const reqIdRef = useRef(0);
  useEffect(() => {
    if (!snap || pts.length < 2) {
      setSnapped(null);
      return;
    }
    const reqId = ++reqIdRef.current;
    snapRoute.mutate(
      { body: { points: pts.map(([lng, lat]) => ({ lat, lng })) } },
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
  }, [pts, snap]);

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
          onMapClick={addPoint}
          drawCoords={drawCoords}
          markers={
            drawCoords.length
              ? [
                  { lng: drawCoords[0][0], lat: drawCoords[0][1], type: "start" },
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
              : undefined
          }
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
            style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "#fff" }}
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

      {/* bottom sheet */}
      <div
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
