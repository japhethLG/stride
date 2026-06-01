/**
 * RouteLeaderboardPage — ported from design/project/screens-routes.jsx
 * `LeaderboardScreen`.
 *
 * Real wiring: resolve the route's default segment via `useRoute(id)`
 * (`segments[0].id`), then `useSegmentLeaderboard(segmentId, {period})` for the
 * ranked board and `useMySegmentRank(segmentId, {period})` for the pinned "your
 * rank". Medals (top 3), gap-to-leader, and "Beat it" -> /record?routeId.
 *
 * The period filter (all/month/week) maps to the API. The design's "activity
 * type" chip has no backend filter (the leaderboard is per-segment, all types),
 * so it is kept as a visual-only chip — TODO(CP6): server-side type filtering.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Btn, Card, Icon, IconBtn, Row, Spinner } from "@/components/primitives";
import { TopBar, Chip, Empty } from "@/components/chrome";
import { useRoute } from "@/lib/api/routes";
import { useRouteMembers } from "@/lib/api/memberships";
import {
  useSegmentLeaderboard,
  useMySegmentRank,
  type LeaderboardPeriod,
} from "@/lib/api/leaderboard";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useUnits } from "@/lib/prefs/store";
import { BaseSheet } from "@/components/sheets";
import { fmtKm, distUnit, fmtTime } from "@/lib/format";
import {
  MEDAL_COLORS,
  asNum,
  asText,
  fmtGapSeconds,
  fmtPaceUnit,
  msStringToSeconds,
  paceSPerKm,
  userLabel,
} from "./_shared";

const PERIOD_LABEL: Record<LeaderboardPeriod, string> = {
  all: "All time",
  month: "This month",
  week: "This week",
};

export function RouteLeaderboardPage() {
  const nav = useNavigate();
  const { id = "" } = useParams<{ id: string }>();
  const units = useUnits();
  const { user } = useAuth();

  const [filterOpen, setFilterOpen] = useState(false);
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");

  const routeQ = useRoute(id);
  const membersQ = useRouteMembers(id);
  const route = routeQ.data;
  const segmentId = route?.segments?.[0]?.id;
  const segmentDistanceM = route?.segments?.[0]?.distanceM ?? route?.distanceM ?? 0;
  const distKm = (route?.distanceM ?? 0) / 1000;

  const boardQ = useSegmentLeaderboard(segmentId, { period, limit: 100 });
  const myRankQ = useMySegmentRank(segmentId, { period });

  const nameByUid = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of membersQ.data?.members ?? []) {
      if (m.userId) map.set(m.userId, userLabel(m.user));
    }
    return map;
  }, [membersQ.data]);

  const entries = boardQ.data?.entries ?? [];
  const leaderSeconds = entries.length ? msStringToSeconds(entries[0].elapsedMs) : 0;
  const totalAthletes = boardQ.data?.totalAthletes ?? 0;

  const myEntry = myRankQ.data?.entry ?? null;
  const mySeconds = myEntry ? msStringToSeconds(myEntry.elapsedMs) : 0;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <TopBar
        title="Leaderboard"
        onBack={() => nav(-1)}
        right={<IconBtn name="filter" onClick={() => setFilterOpen(true)} />}
      />
      {/* segment header */}
      <div style={{ padding: "0 20px 14px", flexShrink: 0 }}>
        <Card pad={14} interactive onClick={() => nav("/routes/" + id)}>
          <Row style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{asText(route?.name) || "Route"}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 2 }}>
                {fmtKm(distKm, units)} {distUnit(units)} · +{Math.round(asNum(route?.elevationGainM))} m ·{" "}
                {totalAthletes} athlete{totalAthletes !== 1 ? "s" : ""}
              </div>
            </div>
            <Icon name="chevR" size={20} color="var(--text-4)" />
          </Row>
        </Card>
        <div style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto" }}>
          <Chip icon="calendar" active={period !== "all"} onClick={() => setFilterOpen(true)}>
            {PERIOD_LABEL[period]}
          </Chip>
          <Chip icon="users" onClick={() => setFilterOpen(true)}>
            Everyone
          </Chip>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 96px" }}>
        {routeQ.isLoading || boardQ.isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Spinner size={26} color="var(--accent)" />
          </div>
        ) : boardQ.isError ? (
          <Empty
            icon="warning"
            title="Couldn't load leaderboard"
            sub={boardQ.error?.message ?? "Something went wrong."}
            action="Retry"
            onAction={() => boardQ.refetch()}
          />
        ) : entries.length === 0 ? (
          <Empty
            icon="trophy"
            title="No times yet"
            sub="Be the first to set a time on this route."
          />
        ) : (
          <Card pad={0}>
            {entries.map((e, i) => {
              const elapsedS = msStringToSeconds(e.elapsedMs);
              const me = !!user && e.userId === user.uid;
              const medal = MEDAL_COLORS[e.rank - 1];
              const gap = i === 0 ? null : "+" + fmtGapSeconds(elapsedS - leaderSeconds);
              const label = me ? "You" : nameByUid.get(e.userId) ?? "Runner";
              return (
                <Row
                  key={e.activityId}
                  onClick={() => nav("/activities/" + e.activityId)}
                  gap={12}
                  pad="13px 14px"
                  style={{
                    borderBottom: i === entries.length - 1 ? "none" : "1px solid var(--border)",
                    background: me ? "var(--accent-soft)" : "transparent",
                  }}
                >
                  <div style={{ width: 30, textAlign: "center", flexShrink: 0 }}>
                    {e.rank <= 3 ? (
                      <Icon name="medal" size={24} color={medal} stroke={2} />
                    ) : (
                      <span className="stat-num" style={{ fontSize: 19, color: "var(--text-3)" }}>
                        {e.rank}
                      </span>
                    )}
                  </div>
                  <Avatar name={label} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                      {fmtPaceUnit(paceSPerKm(elapsedS, segmentDistanceM), units)} /{distUnit(units)} ·{" "}
                      {gap || "Leader"}
                    </div>
                  </div>
                  <span
                    className="stat-num"
                    style={{ fontSize: 24, color: me ? "var(--accent)" : "var(--text)" }}
                  >
                    {fmtTime(elapsedS)}
                  </span>
                </Row>
              );
            })}
          </Card>
        )}
      </div>

      {/* my rank pinned */}
      {myEntry && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "12px 20px 18px",
            background: "linear-gradient(180deg, transparent, var(--bg) 25%)",
          }}
        >
          <Card pad={12} style={{ background: "var(--surface-3)", borderColor: "var(--accent)" }}>
            <Row gap={12}>
              <div style={{ textAlign: "center", width: 34 }}>
                <div className="stat-num" style={{ fontSize: 24, color: "var(--accent)" }}>
                  {myEntry.rank}
                </div>
                <div className="eyebrow" style={{ fontSize: 8 }}>
                  You
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>Your best · {fmtTime(mySeconds)}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                  {mySeconds > leaderSeconds && leaderSeconds > 0
                    ? `+${fmtGapSeconds(mySeconds - leaderSeconds)} to leader`
                    : "Leader"}
                </div>
              </div>
              <Btn size="sm" onClick={() => nav("/record?routeId=" + id)}>
                Beat it
              </Btn>
            </Row>
          </Card>
        </div>
      )}

      <BaseSheet open={filterOpen} onOpenChange={setFilterOpen} title="Filters">
        <div style={{ marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Time period
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(
              [
                ["all", "All time"],
                ["month", "This month"],
                ["week", "This week"],
              ] as [LeaderboardPeriod, string][]
            ).map(([v, l]) => (
              <Chip key={v} active={period === v} onClick={() => setPeriod(v)}>
                {l}
              </Chip>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <Btn full size="lg" onClick={() => setFilterOpen(false)}>
            Apply
          </Btn>
        </div>
      </BaseSheet>
    </div>
  );
}
