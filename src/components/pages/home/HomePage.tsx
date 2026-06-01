/**
 * HomePage (CP5) — the dashboard, ported verbatim from
 * design/project/screens-home.jsx `HomeScreen`, wired to the real backend:
 *
 *   - greeting + avatar/bell (useMe + useAuth + useInvites badge)
 *   - Record hero (-> /record) with the real MapView replacing FauxMap
 *   - lifetime stats (useStatsSummary)
 *   - pending invites (useInvites + accept/decline)
 *   - recent runs (useMyActivities limit 3 -> ActivityRow -> /activities/:id)
 *   - my routes (useRoutes scope 'mine' -> RouteCard -> /routes/:id)
 *   - the syncing banner (recording store pendingCount — buffered unsynced runs)
 *
 * Visuals (inline-style + tokens) are kept byte-for-byte; only the data source
 * and navigation change (react-router `useNavigate`; toasts via `useToast`).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar, Btn, Card, Icon, IconBtn, Row, Spinner } from "@/components/primitives";
import {
  ActivityRow,
  Empty,
  RouteCard,
  SectionHead,
} from "@/components/chrome";
import { MapView } from "@/components/map/MapView";
import { useMe } from "@/lib/api/auth";
import { useStatsSummary } from "@/lib/api/stats";
import { useMyActivities } from "@/lib/api/activities";
import { useRoutes } from "@/lib/api/routes";
import { useInvites, useAcceptInvite, useDeclineInvite } from "@/lib/api/memberships";
import { useRecordingStore } from "@/lib/recording/store";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useUnits } from "@/lib/prefs/store";
import { distUnit } from "@/lib/format";
import { useToast } from "@/lib/useToast";
import { metersToKm, toActivityRow, toRouteCard } from "@/lib/viewModel";

function greeting(hr: number): string {
  return hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
}

/** Lifetime moving time → whole hours (the design shows "h"). */
function fmtHours(totalDurationMs: string | number | undefined): string {
  const ms = Number(totalDurationMs ?? 0);
  if (!Number.isFinite(ms) || ms <= 0) return "0";
  return String(Math.round(ms / 3_600_000));
}

export function HomePage() {
  const navigate = useNavigate();
  const units = useUnits();
  const toast = useToast();
  const { user } = useAuth();

  const me = useMe();
  const stats = useStatsSummary();
  const activities = useMyActivities({ limit: 3 });
  const routes = useRoutes({ scope: "mine" });
  const invites = useInvites();
  const acceptInvite = useAcceptInvite();
  const declineInvite = useDeclineInvite();

  // Syncing banner: runs buffered on-device that haven't been POSTed yet.
  const [unsynced, setUnsynced] = useState(0);
  const pendingCount = useRecordingStore((s) => s.pendingCount);
  const recordingStatus = useRecordingStore((s) => s.status);
  useEffect(() => {
    let alive = true;
    void pendingCount().then((n) => {
      if (alive) setUnsynced(n);
    });
    return () => {
      alive = false;
    };
  }, [pendingCount, recordingStatus]);

  const displayName =
    (me.data?.displayName as string | null) ??
    user?.displayName ??
    user?.email?.split("@")[0] ??
    "Runner";
  const firstName = displayName.split(" ")[0];

  const hr = new Date().getHours();
  const inviteList = invites.data?.invites ?? [];

  const lifetimeStats = [
    {
      v:
        stats.data == null
          ? "--"
          : metersToKm(stats.data.totalDistanceM).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            }),
      u: distUnit(units),
      l: "Total distance",
    },
    { v: stats.data == null ? "--" : fmtHours(stats.data.totalDurationMs), u: "h", l: "Active time" },
    { v: stats.data == null ? "--" : String(stats.data.activityCount), u: "runs", l: "Activities" },
  ];

  const recent = activities.data?.items ?? [];
  const myRoutes = routes.data?.routes ?? [];

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "auto" }}>
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px 8px",
        }}
      >
        <div>
          <div style={{ color: "var(--text-3)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
            {greeting(hr)},
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 26,
              lineHeight: 1,
              letterSpacing: ".3px",
            }}
          >
            {firstName}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconBtn
            name="bell"
            size={42}
            iconSize={20}
            badge={inviteList.length || undefined}
            onClick={() => toast.show("Notifications")}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate("/profile")}
            style={{ cursor: "pointer" }}
          >
            <Avatar
              name={displayName}
              src={(me.data?.photoUrl as string | null) ?? user?.photoUrl ?? undefined}
              size={42}
              color="var(--accent)"
            />
          </div>
        </div>
      </div>

      <div style={{ padding: "4px 20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
        {unsynced > 0 && (
          <Row gap={8} style={{ color: "var(--warn)", fontSize: 12.5, fontWeight: 600 }}>
            <Icon name="refresh" size={15} /> {unsynced} activity syncing — saved on this device
          </Row>
        )}

        {/* Record hero */}
        <div
          onClick={() => navigate("/record")}
          style={{
            position: "relative",
            height: 188,
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
            cursor: "pointer",
            border: "1px solid var(--border)",
          }}
        >
          <MapView interactive={false} fit={false} glow={false} style={{ position: "absolute", inset: 0 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(110deg, rgba(9,10,13,.82) 30%, rgba(9,10,13,.1) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div className="eyebrow" style={{ color: "var(--accent)" }}>
              Ready when you are
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 32, lineHeight: 0.95 }}>
                Start a run
              </div>
              <Row gap={10} style={{ marginTop: 14 }}>
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 8px 22px var(--accent-soft)",
                  }}
                >
                  <Icon name="play" size={24} fill color="#fff" stroke={0} />
                </div>
                <span style={{ color: "var(--text-2)", fontSize: 13.5, fontWeight: 600 }}>
                  Free run, or pick a route
                </span>
              </Row>
            </div>
          </div>
        </div>

        {/* lifetime stats */}
        <Card pad={0} style={{ display: "flex", overflow: "hidden" }}>
          {lifetimeStats.map((s, i) => (
            <div
              key={s.l}
              style={{
                flex: 1,
                padding: "16px 8px",
                textAlign: "center",
                borderLeft: i ? "1px solid var(--border)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, justifyContent: "center" }}>
                <span className="stat-num" style={{ fontSize: 30 }}>
                  {s.v}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 700 }}>{s.u}</span>
              </div>
              <div className="eyebrow" style={{ fontSize: 9.5, marginTop: 4 }}>
                {s.l}
              </div>
            </div>
          ))}
        </Card>

        {/* invites */}
        {inviteList.map((inv) => {
          const inviterName =
            (inv.user?.displayName as string | null) ?? inv.invitedEmail ?? "Someone";
          return (
            <Card
              key={inv.id}
              pad={14}
              style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}
            >
              <Row gap={11}>
                <Avatar name={inviterName} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text-2)" }}>
                    <b style={{ color: "var(--text)" }}>{inviterName}</b> invited you to a route
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Join the route</div>
                </div>
              </Row>
              <Row gap={8} style={{ marginTop: 12 }}>
                <Btn
                  size="sm"
                  full
                  loading={acceptInvite.isPending}
                  onClick={() =>
                    acceptInvite.mutate(
                      { params: { path: { inviteId: inv.id } } },
                      {
                        onSuccess: () => toast.show("Invite accepted"),
                        onError: () => toast.show("Couldn't accept invite"),
                      },
                    )
                  }
                >
                  Accept
                </Btn>
                <Btn
                  size="sm"
                  full
                  variant="secondary"
                  loading={declineInvite.isPending}
                  onClick={() =>
                    declineInvite.mutate(
                      { params: { path: { inviteId: inv.id } } },
                      {
                        onSuccess: () => toast.show("Invite declined"),
                        onError: () => toast.show("Couldn't decline invite"),
                      },
                    )
                  }
                >
                  Decline
                </Btn>
              </Row>
            </Card>
          );
        })}

        {/* recent activities */}
        <div>
          <SectionHead title="Recent runs" action="See all" onAction={() => navigate("/profile")} />
          {activities.isLoading ? (
            <div style={{ textAlign: "center", padding: 16 }}>
              <Spinner />
            </div>
          ) : activities.isError ? (
            <Empty icon="warning" title="Couldn't load runs" sub="Pull to refresh or try again later." />
          ) : recent.length === 0 ? (
            <Empty icon="shoe" title="No runs yet" sub="Start your first run from the hero above." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recent.map((a) => (
                <ActivityRow
                  key={a.id}
                  a={toActivityRow(a)}
                  units={units}
                  onClick={() => navigate("/activities/" + a.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* my routes */}
        <div>
          <SectionHead title="My routes" action="All routes" onAction={() => navigate("/routes")} />
          {routes.isLoading ? (
            <div style={{ textAlign: "center", padding: 16 }}>
              <Spinner />
            </div>
          ) : routes.isError ? (
            <Empty icon="warning" title="Couldn't load routes" sub="Pull to refresh or try again later." />
          ) : myRoutes.length === 0 ? (
            <Empty
              icon="route"
              title="No routes yet"
              sub="Create a route to invite friends and race the leaderboard."
              action="New route"
              onAction={() => navigate("/routes/new")}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {myRoutes.map((r) => (
                <RouteCard
                  key={r.id}
                  r={toRouteCard(r, { myUserId: user?.uid })}
                  units={units}
                  onClick={() => navigate("/routes/" + r.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {toast.node}
    </div>
  );
}
