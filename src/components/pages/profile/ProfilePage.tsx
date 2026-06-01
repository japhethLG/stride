/**
 * ProfilePage (CP5) — ported verbatim from design/project/screens-home.jsx
 * `ProfileScreen`, wired to the real backend:
 *
 *   - identity (useMe + useAuth fallback)
 *   - totals grid (useStatsSummary) — Distance / Moving time / Activities;
 *     Elevation is not in the stats summary endpoint so it renders a graceful
 *     placeholder (TODO(CP6): add a lifetime-elevation field server-side).
 *   - Activities / Routes tabs (useMyActivities / useRoutes scope 'member')
 *   - rows navigate to /activities/:id and /routes/:id
 *
 * Inline-style + token visuals kept byte-for-byte; only data + navigation change.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar, Card, Icon, IconBtn, Row, Segmented, Spinner } from "@/components/primitives";
import { ActivityRow, Empty, RouteCard, TopBar } from "@/components/chrome";
import { useMe } from "@/lib/api/auth";
import { useStatsSummary } from "@/lib/api/stats";
import { useMyActivities } from "@/lib/api/activities";
import { useRoutes } from "@/lib/api/routes";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useUnits } from "@/lib/prefs/store";
import { distUnit, fmtTime } from "@/lib/format";
import { metersToKm, toActivityRow, toRouteCard } from "@/lib/viewModel";

type Tab = "activities" | "routes";

export function ProfilePage() {
  const navigate = useNavigate();
  const units = useUnits();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("activities");

  const me = useMe();
  const stats = useStatsSummary();
  const activities = useMyActivities({ limit: 50 });
  // 'member' returns routes the user owns OR is a joined member of (the design's
  // OWNER || MEMBER filter).
  const routes = useRoutes({ scope: "member" });

  const displayName =
    (me.data?.displayName as string | null) ??
    user?.displayName ??
    user?.email?.split("@")[0] ??
    "Runner";
  const email = me.data?.email ?? user?.email ?? "";

  // Moving time → "H:MM" hours-minutes (the design rendered "78:14" with a "h"
  // suffix). fmtTime gives H:MM:SS; trim the seconds for the totals card.
  const movingMs = Number(stats.data?.totalDurationMs ?? 0);
  const movingTime = stats.data == null ? "--" : trimSeconds(fmtTime(movingMs / 1000));

  const totals = [
    {
      v:
        stats.data == null
          ? "--"
          : metersToKm(stats.data.totalDistanceM).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            }),
      u: distUnit(units),
      l: "Distance",
      i: "ruler" as const,
    },
    { v: movingTime, u: "h", l: "Moving time", i: "clock" as const },
    { v: stats.data == null ? "--" : String(stats.data.activityCount), u: "", l: "Activities", i: "shoe" as const },
    // TODO(CP6): lifetime elevation is not exposed by /api/stats/summary yet.
    { v: "--", u: distUnit(units) === "mi" ? "ft" : "m", l: "Elevation", i: "mountain" as const },
  ];

  const items = activities.data?.items ?? [];
  const myRoutes = routes.data?.routes ?? [];

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "auto" }}>
      <TopBar title="Profile" right={<IconBtn name="settings" onClick={() => navigate("/settings")} />} />
      <div style={{ padding: "8px 20px 24px" }}>
        {/* identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar
            name={displayName}
            src={(me.data?.photoUrl as string | null) ?? user?.photoUrl ?? undefined}
            size={72}
            color="var(--accent)"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, lineHeight: 1 }}>
              {displayName}
            </div>
            <div style={{ color: "var(--text-3)", fontSize: 13.5, marginTop: 3 }}>{email}</div>
          </div>
          <IconBtn name="edit" onClick={() => navigate("/settings")} />
        </div>

        {/* totals */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
          {totals.map((s) => (
            <Card key={s.l} pad={14}>
              <Row gap={6} style={{ color: "var(--text-3)", marginBottom: 8 }}>
                <Icon name={s.i} size={15} />
                <span className="eyebrow" style={{ fontSize: 10 }}>
                  {s.l}
                </span>
              </Row>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span className="stat-num" style={{ fontSize: 30 }}>
                  {s.v}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 700 }}>{s.u}</span>
              </div>
            </Card>
          ))}
        </div>

        <Segmented
          style={{ marginTop: 20 }}
          options={[
            { value: "activities", label: "Activities" },
            { value: "routes", label: "Routes" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {tab === "activities" ? (
            activities.isLoading ? (
              <div style={{ textAlign: "center", padding: 16 }}>
                <Spinner />
              </div>
            ) : activities.isError ? (
              <Empty icon="warning" title="Couldn't load activities" sub="Try again later." />
            ) : items.length === 0 ? (
              <Empty icon="shoe" title="No activities yet" sub="Your finished runs show up here." />
            ) : (
              items.map((a) => (
                <ActivityRow
                  key={a.id}
                  a={toActivityRow(a)}
                  units={units}
                  onClick={() => navigate("/activities/" + a.id)}
                />
              ))
            )
          ) : routes.isLoading ? (
            <div style={{ textAlign: "center", padding: 16 }}>
              <Spinner />
            </div>
          ) : routes.isError ? (
            <Empty icon="warning" title="Couldn't load routes" sub="Try again later." />
          ) : myRoutes.length === 0 ? (
            <Empty
              icon="route"
              title="No routes yet"
              sub="Create a route to invite friends and race the leaderboard."
              action="New route"
              onAction={() => navigate("/routes/new")}
            />
          ) : (
            myRoutes.map((r) => (
              <RouteCard
                key={r.id}
                r={toRouteCard(r, { myUserId: user?.uid })}
                units={units}
                onClick={() => navigate("/routes/" + r.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** "H:MM:SS" -> "H:MM" (drop the trailing seconds for the totals card). */
function trimSeconds(t: string): string {
  const parts = t.split(":");
  if (parts.length === 3) return `${parts[0]}:${parts[1]}`;
  return t;
}
