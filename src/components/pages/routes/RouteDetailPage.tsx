/**
 * RouteDetailPage — ported from design/project/screens-routes.jsx
 * `RouteDetailScreen`.
 *
 * Real wiring: `useRoute(id)` (geometry + segments + memberCount) drives the
 * MapLibre `MapView` header (route line + start/finish markers), the stats card,
 * and the elevation profile. `useRouteLeaderboard(id)` powers the top-3 preview,
 * `useRouteMembers(id)` the member avatars, and `useLiveParticipants(id)` the
 * "running now" pill (-> /routes/:id/live). "Start run on this route" navigates
 * to /record?routeId=:id.
 */
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Btn, Card, IconBtn, Row, Spinner, Tag } from "@/components/primitives";
import { SectionHead, StatusPill, Empty } from "@/components/chrome";
import { MapView } from "@/components/map/MapView";
import { useRoute, useRouteLeaderboard } from "@/lib/api/routes";
import { useRouteMembers } from "@/lib/api/memberships";
import { useLiveParticipants } from "@/lib/api/live";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useUnits } from "@/lib/prefs/store";
import { fmtKm, distUnit } from "@/lib/format";
import {
  ElevationChart,
  LeaderRow,
  asNum,
  asText,
  fmtTime,
  lineCoords,
  msStringToSeconds,
  paceSPerKm,
  fmtPaceUnit,
  shortDate,
  userLabel,
  type LeaderRowData,
} from "./_shared";

export function RouteDetailPage() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const units = useUnits();
  const { user } = useAuth();

  const routeQ = useRoute(id);
  const leaderboardQ = useRouteLeaderboard(id, { limit: 3 });
  const membersQ = useRouteMembers(id);
  const liveQ = useLiveParticipants(id);

  const route = routeQ.data;
  const coords = lineCoords(route?.geometry);
  const distKm = (route?.distanceM ?? 0) / 1000;
  const segmentDistanceM = route?.segments?.[0]?.distanceM ?? route?.distanceM ?? 0;

  // Join member display names (by userId) so leaderboard rows show real names.
  const nameByUid = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of membersQ.data?.members ?? []) {
      if (m.userId) map.set(m.userId, userLabel(m.user));
    }
    return map;
  }, [membersQ.data]);

  const leaderRows: LeaderRowData[] = useMemo(() => {
    const entries = leaderboardQ.data?.entries ?? [];
    return entries.map((e) => {
      const elapsedS = msStringToSeconds(e.elapsedMs);
      const me = !!user && e.userId === user.uid;
      return {
        rank: e.rank,
        name: me ? "You" : nameByUid.get(e.userId) ?? "Runner",
        me,
        time: fmtTime(elapsedS),
        pace: fmtPaceUnit(paceSPerKm(elapsedS, segmentDistanceM), units),
        meta: shortDate(e.startedAt),
      };
    });
  }, [leaderboardQ.data, nameByUid, user, segmentDistanceM, units]);

  const joined = (membersQ.data?.members ?? []).filter((m) => m.status === "JOINED");
  const liveCount = (liveQ.data?.participants ?? []).filter((p) => p.online).length;

  const start = coords[0];
  const finish = coords[coords.length - 1];
  const isLoop =
    coords.length > 2 && start && finish && start[0] === finish[0] && start[1] === finish[1];

  if (routeQ.isLoading) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner size={28} color="var(--accent)" />
      </div>
    );
  }
  if (routeQ.isError || !route) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 14px" }}>
          <IconBtn name="chevL" onClick={() => nav(-1)} size={40} iconSize={22} />
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Empty
            icon="warning"
            title="Couldn't load route"
            sub={routeQ.error?.message ?? "This route may have been removed."}
            action="Retry"
            onAction={() => routeQ.refetch()}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      {/* map header */}
      <div style={{ position: "relative", height: 280, flexShrink: 0 }}>
        <MapView
          interactive={false}
          routeD={coords}
          markers={[
            ...(start ? [{ lng: start[0], lat: start[1], type: "start" as const }] : []),
            ...(!isLoop && finish
              ? [{ lng: finish[0], lat: finish[1], type: "finish" as const }]
              : []),
          ]}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(180deg, rgba(9,10,13,.6) 0%, transparent 30%, transparent 70%, var(--bg) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 14,
            right: 14,
            display: "flex",
            justifyContent: "space-between",
            zIndex: 6,
          }}
        >
          <IconBtn
            name="chevL"
            onClick={() => nav(-1)}
            style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "#fff" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <IconBtn
              name="share"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  void navigator.clipboard.writeText(window.location.href);
                }
              }}
              style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "#fff" }}
            />
            <IconBtn
              name="more"
              onClick={() => nav("/routes/" + route.id + "/members")}
              style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "#fff" }}
            />
          </div>
        </div>
        {liveCount > 0 && (
          <button
            onClick={() => nav("/routes/" + route.id + "/live")}
            style={{
              position: "absolute",
              bottom: 18,
              left: 20,
              zIndex: 6,
              border: "none",
              cursor: "pointer",
              background: "none",
            }}
          >
            <StatusPill tone="live">{liveCount} running now · Watch live</StatusPill>
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 110px", marginTop: -8 }}>
        <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 32, lineHeight: 1, fontWeight: 700 }}>{route.name}</h1>
            <Row gap={7} style={{ marginTop: 8 }}>
              {!route.isPublic && (
                <Tag size="sm" icon="lock">
                  Private
                </Tag>
              )}
            </Row>
          </div>
        </Row>
        {asText(route.description) && (
          <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.5, marginTop: 12 }}>
            {asText(route.description)}
          </p>
        )}

        {/* stats */}
        <Card pad={0} style={{ display: "flex", marginTop: 16 }}>
          {(
            [
              [fmtKm(distKm, units), distUnit(units), "Distance"],
              ["+" + Math.round(asNum(route.elevationGainM)), "m", "Elevation"],
              [String(route.segments?.length ?? 0), "", "Segment"],
            ] as [string, string, string][]
          ).map((s, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: "16px 8px",
                textAlign: "center",
                borderLeft: i ? "1px solid var(--border)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, justifyContent: "center" }}>
                <span className="stat-num" style={{ fontSize: 28 }}>
                  {s[0]}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 700 }}>{s[1]}</span>
              </div>
              <div className="eyebrow" style={{ fontSize: 9.5, marginTop: 4 }}>
                {s[2]}
              </div>
            </div>
          ))}
        </Card>

        {/* elevation */}
        <div style={{ marginTop: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Elevation profile
          </div>
          <Card pad={14}>
            <ElevationChart profile={route.elevationProfile} h={70} id={"eg-" + route.id} />
          </Card>
        </div>

        {/* leaderboard preview */}
        <div style={{ marginTop: 22 }}>
          <SectionHead
            title="Leaderboard"
            action="Full board"
            onAction={() => nav("/routes/" + route.id + "/leaderboard")}
          />
          <Card pad={0}>
            {leaderboardQ.isLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "22px 0" }}>
                <Spinner color="var(--accent)" />
              </div>
            ) : leaderRows.length === 0 ? (
              <Empty icon="trophy" title="No times yet" sub="Be the first to set a time on this route." />
            ) : (
              leaderRows.map((e, i) => (
                <LeaderRow
                  key={i}
                  e={e}
                  units={units}
                  last={i === leaderRows.length - 1}
                  onClick={() => nav("/routes/" + route.id + "/leaderboard")}
                />
              ))
            )}
          </Card>
        </div>

        {/* members */}
        <div style={{ marginTop: 22 }}>
          <SectionHead
            title={`Members (${joined.length})`}
            action="Manage"
            onAction={() => nav("/routes/" + route.id + "/members")}
          />
          <Card pad={14} interactive onClick={() => nav("/routes/" + route.id + "/members")}>
            <Row style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex" }}>
                {joined.slice(0, 5).map((m, i) => (
                  <div key={m.id} style={{ marginLeft: i ? -10 : 0, position: "relative", zIndex: 5 - i }}>
                    <Avatar name={userLabel(m.user)} src={asText(m.user?.photoUrl) || undefined} size={36} ring="var(--surface)" />
                  </div>
                ))}
                {joined.length === 0 && (
                  <span style={{ color: "var(--text-3)", fontSize: 13, fontWeight: 600 }}>
                    No members yet
                  </span>
                )}
              </div>
              <Btn
                size="sm"
                variant="secondary"
                icon="plus"
                onClick={() => nav("/routes/" + route.id + "/members")}
              >
                Invite
              </Btn>
            </Row>
          </Card>
        </div>
      </div>

      {/* start CTA */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "14px 20px 18px",
          background: "linear-gradient(180deg, transparent, var(--bg) 30%)",
          zIndex: 10,
        }}
      >
        <Btn full size="lg" icon="play" onClick={() => nav("/record?routeId=" + route.id)}>
          Start run on this route
        </Btn>
      </div>
    </div>
  );
}
